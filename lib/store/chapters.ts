import { db, newId, nowIso, type ChapterRecord, type ChapterStatus } from "./db"
import { sha256Hex } from "./hash"
import { daysLeftInTrash, isActiveProject } from "./projects"
import { snapshotBeforeSave } from "./versions"
import { countWords } from "@/lib/word-count"
import { nextDefaultName } from "@/lib/default-name"
import type { ChapterLabel } from "@/lib/chapter-config"

export type SerializedChapterSummary = {
  id: string
  title: string
  order: number
  wordCount: number
  status: ChapterStatus
  synopsis: string
  label: ChapterLabel
  flashback: boolean
  storyDate: string
  updatedAt: string
}

export type SerializedChapter = SerializedChapterSummary & {
  projectId: string
  content: unknown
  version: number
}

export type TrashedChapter = { id: string; title: string; wordCount: number; daysLeft: number }

/** Largest chapter accepted, as serialised JSON. */
export const MAX_CHAPTER_BYTES = 3 * 1024 * 1024

function serializeSummary(c: ChapterRecord): SerializedChapterSummary {
  return {
    id: c.id,
    title: c.title,
    order: c.order,
    wordCount: c.wordCount ?? 0,
    status: c.status ?? "draft",
    synopsis: c.synopsis ?? "",
    label: c.label ?? "",
    flashback: Boolean(c.flashback),
    storyDate: c.storyDate ?? "",
    updatedAt: c.updatedAt,
  }
}

/**
 * The one reading order for chapters, used by every list, export, the Read
 * view and reordering. `createdAt` breaks ties.
 */
export function byChapterOrder(a: ChapterRecord, b: ChapterRecord): number {
  return a.order - b.order || a.createdAt.localeCompare(b.createdAt)
}

/** Live chapters of a project, as full records, in reading order. */
export async function listChapterRecords(projectId: string): Promise<ChapterRecord[]> {
  const all = await db().chapters.where("projectId").equals(projectId).toArray()
  return all.filter((c) => !c.deletedAt).sort(byChapterOrder)
}

export async function listChaptersForProject(projectId: string): Promise<SerializedChapterSummary[]> {
  return (await listChapterRecords(projectId)).map(serializeSummary)
}

/** This project's chapters in the Trash, most recently trashed first. */
export async function listTrashedChapters(projectId: string): Promise<TrashedChapter[]> {
  const all = await db().chapters.where("projectId").equals(projectId).toArray()
  return all
    .filter((c): c is ChapterRecord & { deletedAt: string } => Boolean(c.deletedAt))
    .sort((a, b) => b.deletedAt.localeCompare(a.deletedAt))
    .map((c) => ({ id: c.id, title: c.title, wordCount: c.wordCount ?? 0, daysLeft: daysLeftInTrash(c.deletedAt) }))
}

export async function getChapter(projectId: string, chapterId: string): Promise<SerializedChapter | null> {
  const c = await db().chapters.get(chapterId)
  if (!c || c.projectId !== projectId || c.deletedAt) return null
  return { ...serializeSummary(c), projectId, content: c.content ?? null, version: c.version ?? 0 }
}

/** Serialises content to plain JSON (dropping anything that isn't), with a size check. */
function toJson(content: unknown): { ok: true; json: string; value: unknown } | { ok: false; code: "too_large" | "invalid" } {
  try {
    const json = JSON.stringify(content)
    if (new Blob([json]).size > MAX_CHAPTER_BYTES) return { ok: false, code: "too_large" }
    return { ok: true, json, value: JSON.parse(json) }
  } catch {
    return { ok: false, code: "invalid" }
  }
}

export type CreateChapterResult =
  | { ok: true; id: string; version: number }
  | { ok: false; code: "too_large" | "invalid" | "not_found" | "error" }

/**
 * Creates a chapter at the end of the book. `defaultTitleBase` is the
 * singular section label ("Chapter", "Poem"…) used when no title is given.
 */
export async function createChapter(
  projectId: string,
  input: { title?: string; content?: unknown },
  defaultTitleBase: string
): Promise<CreateChapterResult> {
  if (!(await isActiveProject(projectId))) return { ok: false, code: "not_found" }
  const parsed = toJson(input.content ?? { type: "doc", content: [] })
  if (!parsed.ok) return parsed
  const contentHash = await sha256Hex(parsed.json)

  const d = db()
  return d.transaction("rw", d.chapters, async () => {
    const existing = await listChapterRecords(projectId)
    const order = existing.reduce((max, c) => Math.max(max, c.order), -1) + 1
    const typed = typeof input.title === "string" ? input.title.trim().slice(0, 200) : ""
    const title = typed || nextDefaultName(existing.map((c) => c.title), defaultTitleBase)
    const now = nowIso()
    const record: ChapterRecord = {
      id: newId(),
      projectId,
      title,
      content: parsed.value,
      order,
      wordCount: countWords(parsed.value),
      version: 0,
      contentHash,
      status: "draft",
      synopsis: "",
      label: "",
      createdAt: now,
      updatedAt: now,
    }
    await d.chapters.add(record)
    return { ok: true as const, id: record.id, version: 0 }
  })
}

export type SaveChapterInput = {
  title?: string
  content?: unknown
  /** The chapter version this edit was made on top of. */
  baseVersion?: number
  /** "Keep mine" after a conflict: save regardless of the version. */
  force?: boolean
}

export type SaveChapterResult =
  | { ok: true; version: number; wordCount?: number }
  | { ok: false; code: "conflict" | "too_large" | "invalid" | "not_found" | "error" }

/**
 * Saves a chapter's title and/or content. If another tab saved since
 * `baseVersion`, the save is refused as a conflict instead of silently
 * overwriting that tab's text. IndexedDB transactions are serialised across
 * tabs, so the check and the write can't interleave.
 */
export async function saveChapter(
  projectId: string,
  chapterId: string,
  input: SaveChapterInput
): Promise<SaveChapterResult> {
  if (!(await isActiveProject(projectId))) return { ok: false, code: "not_found" }

  const patch: Partial<ChapterRecord> = {}
  if (input.title !== undefined) {
    const title = input.title.trim().slice(0, 200)
    if (!title) return { ok: false, code: "invalid" }
    patch.title = title
  }
  let newHash: string | undefined
  if (input.content !== undefined) {
    const parsed = toJson(input.content)
    if (!parsed.ok) return parsed
    newHash = await sha256Hex(parsed.json)
    patch.content = parsed.value
    patch.contentHash = newHash
    patch.wordCount = countWords(parsed.value)
  }

  const d = db()
  const outcome = await d.transaction("rw", d.chapters, async () => {
    const previous = await d.chapters.get(chapterId)
    if (!previous || previous.projectId !== projectId || previous.deletedAt) return { code: "not_found" as const }
    const current = previous.version ?? 0
    if (!input.force && input.baseVersion !== undefined && input.baseVersion !== current) {
      return { code: "conflict" as const }
    }
    await d.chapters.put({ ...previous, ...patch, version: current + 1, updatedAt: nowIso() })
    return { code: "ok" as const, previous, version: current + 1 }
  })
  if (outcome.code !== "ok") return { ok: false, code: outcome.code }

  // Title-only saves don't touch history, and a failed snapshot must never
  // turn a successful save into an error.
  if (newHash !== undefined) {
    try {
      await snapshotBeforeSave({ previous: outcome.previous, newHash, newWordCount: patch.wordCount })
    } catch (err) {
      console.error("saveChapter: snapshot failed", err)
    }
  }
  return { ok: true, version: outcome.version, wordCount: patch.wordCount }
}

/**
 * Saves a new reading order. `orderedIds` must be exactly the project's
 * current chapters, each once; anything else (a chapter added or trashed in
 * another tab meanwhile) is refused.
 */
export async function reorderChapters(projectId: string, orderedIds: string[]): Promise<boolean> {
  if (!Array.isArray(orderedIds) || !(await isActiveProject(projectId))) return false
  const d = db()
  return d.transaction("rw", d.chapters, async () => {
    const current = await listChapterRecords(projectId)
    const known = new Set(current.map((c) => c.id))
    const unique = new Set(orderedIds)
    if (unique.size !== orderedIds.length || unique.size !== known.size || orderedIds.some((id) => !known.has(id))) {
      return false
    }
    // Reordering isn't writing, so updatedAt stays put.
    await Promise.all(orderedIds.map((id, order) => d.chapters.update(id, { order })))
    return true
  })
}

export type ChapterMetaInput = {
  status?: ChapterStatus
  synopsis?: string
  label?: ChapterLabel
  flashback?: boolean
  /** "YYYY", "YYYY-MM" or "YYYY-MM-DD", or "" to clear. */
  storyDate?: string
}

/** Status, synopsis and colour label: the outline-board details. */
export async function updateChapterMeta(projectId: string, chapterId: string, input: ChapterMetaInput): Promise<boolean> {
  if (!(await isActiveProject(projectId))) return false
  const c = await db().chapters.get(chapterId)
  if (!c || c.projectId !== projectId || c.deletedAt) return false
  const patch: ChapterMetaInput = {}
  if (input.status !== undefined) patch.status = input.status
  if (input.synopsis !== undefined) patch.synopsis = input.synopsis.trim().slice(0, 1000)
  if (input.label !== undefined) patch.label = input.label
  if (input.flashback !== undefined) patch.flashback = input.flashback
  if (input.storyDate !== undefined) patch.storyDate = input.storyDate.trim()
  await db().chapters.update(chapterId, patch)
  return true
}

/** Moves a chapter to the Trash. Nothing is deleted; it can be restored for 30 days. */
export async function trashChapter(projectId: string, chapterId: string): Promise<boolean> {
  if (!(await isActiveProject(projectId))) return false
  const c = await db().chapters.get(chapterId)
  if (!c || c.projectId !== projectId || c.deletedAt) return false
  await db().chapters.update(chapterId, { deletedAt: nowIso() })
  return true
}

/** Brings a chapter back from the Trash, at the end of the book. */
export async function restoreChapter(projectId: string, chapterId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await isActiveProject(projectId))) return { ok: false, error: "Couldn't find this project." }
  const d = db()
  return d.transaction("rw", d.chapters, async () => {
    const c = await d.chapters.get(chapterId)
    if (!c || c.projectId !== projectId || !c.deletedAt) {
      return { ok: false as const, error: "Couldn't find this chapter in the Trash." }
    }
    const last = (await listChapterRecords(projectId)).at(-1)
    const restored: ChapterRecord = { ...c, order: (last?.order ?? -1) + 1 }
    delete restored.deletedAt
    await d.chapters.put(restored)
    return { ok: true as const }
  })
}

/** Permanently deletes a chapter that is already in the Trash, with its versions and comments. */
export async function deleteChapterForever(projectId: string, chapterId: string): Promise<boolean> {
  const d = db()
  const c = await d.chapters.get(chapterId)
  if (!c || c.projectId !== projectId || !c.deletedAt) return false
  await d.transaction("rw", [d.chapters, d.versions, d.comments], async () => {
    await d.versions.where("chapterId").equals(chapterId).delete()
    await d.comments.where("chapterId").equals(chapterId).delete()
    await d.chapters.delete(chapterId)
  })
  return true
}

