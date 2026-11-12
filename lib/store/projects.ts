import { db, newId, nowIso, type ProjectRecord } from "./db"
import {
  ADDABLE_SECTIONS,
  SECTION_DEFS,
  getDefaultSections,
  normalizeProjectType,
  type ProjectType,
  type SectionId,
} from "@/lib/project-config"
import { DEFAULT_MANUSCRIPT_SETTINGS, type ManuscriptSettings } from "@/lib/manuscript-config"
import type { ChapterNumberingStyle } from "@/lib/chapter-numbering"
import type { TrimSizeId } from "@/lib/export-config"
import { TRASH_DAYS } from "@/lib/trash-config"

export type SerializedProject = {
  id: string
  title: string
  type: ProjectType
  genre?: string
  blurb?: string
  authorName?: string
  coverFrontUrl?: string
  coverBackUrl?: string
  chapterNumberingStyle: ChapterNumberingStyle
  chapterNumberingPrefix?: string
  exportTrimSize: TrimSizeId
  targetWordCount?: number
  dailyWordGoal: number
  sections: SectionId[]
  manuscriptSettings: ManuscriptSettings
  createdAt: string
  updatedAt: string
}

/** Shown when someone edits a project that was moved to the Trash in another tab. */
export const TRASHED_PROJECT_ERROR = "This project is in the Trash. Restore it to make changes."

const DAY_MS = 24 * 60 * 60 * 1000

export function daysLeftInTrash(deletedAt: string): number {
  return Math.max(0, Math.ceil((new Date(deletedAt).getTime() + TRASH_DAYS * DAY_MS - Date.now()) / DAY_MS))
}

export function serializeProject(r: ProjectRecord): SerializedProject {
  return {
    id: r.id,
    title: r.title,
    type: normalizeProjectType(r.type),
    genre: r.genre || undefined,
    blurb: r.blurb || undefined,
    authorName: r.authorName || undefined,
    coverFrontUrl: r.coverFrontUrl || undefined,
    coverBackUrl: r.coverBackUrl || undefined,
    chapterNumberingStyle: r.chapterNumberingStyle || "numeral",
    chapterNumberingPrefix: r.chapterNumberingPrefix || undefined,
    exportTrimSize: r.exportTrimSize || "6x9",
    targetWordCount: r.targetWordCount || undefined,
    dailyWordGoal: r.dailyWordGoal ?? 300,
    sections: r.sections ?? [],
    manuscriptSettings: { ...DEFAULT_MANUSCRIPT_SETTINGS, ...r.manuscriptSettings },
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }
}

/** A live (not trashed) project, or null. */
export async function getProject(id: string): Promise<SerializedProject | null> {
  const r = await db().projects.get(id)
  return r && !r.deletedAt ? serializeProject(r) : null
}

/** True if the project exists and is not in the Trash. Every write inside a project checks this. */
export async function isActiveProject(id: string): Promise<boolean> {
  const r = await db().projects.get(id)
  return Boolean(r && !r.deletedAt)
}

export async function listProjects(): Promise<SerializedProject[]> {
  const all = await db().projects.toArray()
  return all.filter((p) => !p.deletedAt).map(serializeProject)
}

export async function createProject(input: { title: string; type: ProjectType }): Promise<string> {
  const now = nowIso()
  const record: ProjectRecord = {
    id: newId(),
    title: input.title,
    type: input.type,
    authorName: "",
    coverFrontUrl: "",
    coverBackUrl: "",
    chapterNumberingStyle: "numeral",
    chapterNumberingPrefix: "",
    exportTrimSize: "6x9",
    dailyWordGoal: 300,
    sections: getDefaultSections(input.type),
    manuscriptSettings: { ...DEFAULT_MANUSCRIPT_SETTINGS },
    createdAt: now,
    updatedAt: now,
  }
  await db().projects.add(record)
  return record.id
}

type ProjectPatch = Partial<
  Pick<
    ProjectRecord,
    | "title"
    | "authorName"
    | "blurb"
    | "genre"
    | "coverFrontUrl"
    | "coverBackUrl"
    | "chapterNumberingStyle"
    | "chapterNumberingPrefix"
    | "exportTrimSize"
  >
>

/** Updates a live project. Returns the record as it was before, or null if it isn't live. */
export async function updateProject(id: string, patch: ProjectPatch): Promise<ProjectRecord | null> {
  return db().transaction("rw", db().projects, async () => {
    const r = await db().projects.get(id)
    if (!r || r.deletedAt) return null
    await db().projects.put({ ...r, ...patch, updatedAt: nowIso() })
    return r
  })
}

export async function updateManuscriptSettings(
  id: string,
  patch: Partial<ManuscriptSettings>
): Promise<ProjectRecord | null> {
  return db().transaction("rw", db().projects, async () => {
    const r = await db().projects.get(id)
    if (!r || r.deletedAt) return null
    await db().projects.put({
      ...r,
      manuscriptSettings: { ...DEFAULT_MANUSCRIPT_SETTINGS, ...r.manuscriptSettings, ...patch },
      updatedAt: nowIso(),
    })
    return r
  })
}

/** Adds an optional section to the sidebar, just before Export. */
export async function addSection(id: string, sectionId: SectionId): Promise<boolean> {
  if (!ADDABLE_SECTIONS.includes(sectionId) || !(sectionId in SECTION_DEFS)) return false
  return db().transaction("rw", db().projects, async () => {
    const r = await db().projects.get(id)
    if (!r || r.deletedAt) return false
    if (r.sections.includes(sectionId)) return true
    const next = [...r.sections]
    const exportIndex = next.indexOf("export")
    next.splice(exportIndex === -1 ? next.length : exportIndex, 0, sectionId)
    await db().projects.put({ ...r, sections: next, updatedAt: nowIso() })
    return true
  })
}

// ---------------------------------------------------------------------------
// Trash
// ---------------------------------------------------------------------------

export type TrashedProject = {
  id: string
  title: string
  type: ProjectType
  deletedAt: string
  daysLeft: number
}

/** Moves a project to the Trash. Nothing is deleted; it can be restored for TRASH_DAYS days. */
export async function trashProject(id: string): Promise<boolean> {
  // Trashing isn't editing, so updatedAt stays put.
  return (await db().projects.where("id").equals(id).and((p) => !p.deletedAt).modify({ deletedAt: nowIso() })) > 0
}

export async function restoreProject(id: string): Promise<boolean> {
  return (
    (await db()
      .projects.where("id")
      .equals(id)
      .and((p) => Boolean(p.deletedAt))
      .modify((p) => {
        delete p.deletedAt
      })) > 0
  )
}

/** Permanently deletes a project that is already in the Trash, with everything in it. */
export async function deleteProjectForever(id: string): Promise<boolean> {
  const r = await db().projects.get(id)
  if (!r || !r.deletedAt) return false
  await purgeProject(id)
  return true
}

/** Removes a project and everything in it, children first. */
async function purgeProject(projectId: string): Promise<void> {
  const d = db()
  await d.transaction(
    "rw",
    [d.projects, d.chapters, d.versions, d.characters, d.worldEntries, d.plotThreads, d.notes, d.researchEntries, d.comments, d.assets],
    async () => {
      await Promise.all([
        d.chapters.where("projectId").equals(projectId).delete(),
        d.versions.where("projectId").equals(projectId).delete(),
        d.characters.where("projectId").equals(projectId).delete(),
        d.worldEntries.where("projectId").equals(projectId).delete(),
        d.plotThreads.where("projectId").equals(projectId).delete(),
        d.notes.where("projectId").equals(projectId).delete(),
        d.researchEntries.where("projectId").equals(projectId).delete(),
        d.comments.where("projectId").equals(projectId).delete(),
        d.assets.where("projectId").equals(projectId).delete(),
      ])
      await d.projects.delete(projectId)
    }
  )
}

export async function listTrashedProjects(): Promise<TrashedProject[]> {
  const all = await db().projects.toArray()
  return all
    .filter((p): p is ProjectRecord & { deletedAt: string } => Boolean(p.deletedAt))
    .sort((a, b) => b.deletedAt.localeCompare(a.deletedAt))
    .map((p) => ({
      id: p.id,
      title: p.title,
      type: normalizeProjectType(p.type),
      deletedAt: p.deletedAt,
      daysLeft: daysLeftInTrash(p.deletedAt),
    }))
}

export async function countTrashedProjects(): Promise<number> {
  return (await db().projects.toArray()).filter((p) => p.deletedAt).length
}

/** Deletes projects and chapters that have been in the Trash longer than TRASH_DAYS. */
export async function purgeExpiredTrash(): Promise<void> {
  const d = db()
  const cutoff = new Date(Date.now() - TRASH_DAYS * DAY_MS).toISOString()
  const projects = await d.projects.toArray()
  for (const p of projects) {
    if (p.deletedAt && p.deletedAt < cutoff) await purgeProject(p.id)
  }
  const chapters = await d.chapters.toArray()
  const expired = chapters.filter((c) => c.deletedAt && c.deletedAt < cutoff).map((c) => c.id)
  if (expired.length > 0) {
    await d.transaction("rw", [d.chapters, d.versions, d.comments], async () => {
      await d.versions.where("chapterId").anyOf(expired).delete()
      await d.comments.where("chapterId").anyOf(expired).delete()
      await d.chapters.bulkDelete(expired)
    })
  }
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export type DashboardHero = {
  id: string
  title: string
  type: ProjectType
  chapter: { id: string; title: string; updatedAt: string } | null
}

export type DashboardOther = {
  id: string
  title: string
  type: ProjectType
  updatedAt: string
}

export type DashboardData = { hero: DashboardHero | null; others: DashboardOther[] }

/**
 * Live projects ordered by last activity: when their most recently edited
 * chapter was edited (falling back to the project's own updatedAt), so
 * renaming a project doesn't count as "worked on".
 */
export async function getDashboardData(): Promise<DashboardData> {
  const d = db()
  const projects = (await d.projects.toArray()).filter((p) => !p.deletedAt)
  if (projects.length === 0) return { hero: null, others: [] }

  const latest = new Map<string, { id: string; title: string; updatedAt: string }>()
  await d.chapters.each((c) => {
    if (c.deletedAt) return
    const current = latest.get(c.projectId)
    if (!current || c.updatedAt > current.updatedAt) {
      latest.set(c.projectId, { id: c.id, title: c.title, updatedAt: c.updatedAt })
    }
  })

  const ranked = projects
    .map((p) => {
      const chapter = latest.get(p.id) ?? null
      return { project: p, chapter, activity: chapter?.updatedAt ?? p.updatedAt }
    })
    .sort((a, b) => b.activity.localeCompare(a.activity))

  const [first, ...rest] = ranked
  return {
    hero: {
      id: first.project.id,
      title: first.project.title,
      type: normalizeProjectType(first.project.type),
      chapter: first.chapter ? { ...first.chapter, updatedAt: first.activity } : null,
    },
    others: rest.map((r) => ({
      id: r.project.id,
      title: r.project.title,
      type: normalizeProjectType(r.project.type),
      updatedAt: r.activity,
    })),
  }
}

