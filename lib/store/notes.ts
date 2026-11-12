import { db, newId, nowIso, type NoteRecord, type ResearchEntryRecord } from "./db"
import { isActiveProject } from "./projects"
import type { ResearchEntryType } from "@/lib/research-config"

/** Notes and Research entries: free-form material kept alongside the book. */

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------

export type SerializedNoteSummary = {
  id: string
  title: string
  content?: string
  tags: string[]
  pinned: boolean
  updatedAt: string
}

export type SerializedNote = SerializedNoteSummary & { projectId: string; createdAt: string }

export function serializeNoteSummary(n: NoteRecord): SerializedNoteSummary {
  return {
    id: n.id,
    title: n.title,
    content: n.content || undefined,
    tags: n.tags ?? [],
    pinned: Boolean(n.pinned),
    updatedAt: n.updatedAt,
  }
}

export async function listNoteRecords(projectId: string): Promise<NoteRecord[]> {
  return db().notes.where("projectId").equals(projectId).toArray()
}

/** Pinned first, then most recently touched. */
export async function listNotesForProject(projectId: string): Promise<SerializedNoteSummary[]> {
  const all = await listNoteRecords(projectId)
  return all
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt))
    .map(serializeNoteSummary)
}

export async function getNote(projectId: string, id: string): Promise<SerializedNote | null> {
  const n = await db().notes.get(id)
  if (!n || n.projectId !== projectId) return null
  return { ...serializeNoteSummary(n), projectId, createdAt: n.createdAt }
}

export async function createNote(
  projectId: string,
  fields: { title: string; content: string; tags?: string[] }
): Promise<SerializedNoteSummary | null> {
  if (!(await isActiveProject(projectId))) return null
  const now = nowIso()
  const record: NoteRecord = {
    id: newId(),
    projectId,
    title: fields.title,
    content: fields.content,
    tags: fields.tags ?? [],
    pinned: false,
    createdAt: now,
    updatedAt: now,
  }
  await db().notes.add(record)
  return serializeNoteSummary(record)
}

export async function updateNote(
  projectId: string,
  id: string,
  fields: Partial<Pick<NoteRecord, "title" | "content" | "tags" | "pinned">>
): Promise<boolean> {
  if (!(await isActiveProject(projectId))) return false
  const n = await db().notes.get(id)
  if (!n || n.projectId !== projectId) return false
  await db().notes.update(id, { ...fields, updatedAt: nowIso() })
  return true
}

export async function deleteNote(projectId: string, id: string): Promise<boolean> {
  if (!(await isActiveProject(projectId))) return false
  const n = await db().notes.get(id)
  if (!n || n.projectId !== projectId) return false
  await db().notes.delete(id)
  return true
}

// ---------------------------------------------------------------------------
// Research
// ---------------------------------------------------------------------------

export type SerializedResearchEntrySummary = {
  id: string
  title: string
  type: ResearchEntryType
  url?: string
  content?: string
  imageUrl?: string
  faviconUrl?: string
  siteName?: string
  updatedAt: string
}

export type SerializedResearchEntry = SerializedResearchEntrySummary & { projectId: string; createdAt: string }

export function serializeResearchEntrySummary(r: ResearchEntryRecord): SerializedResearchEntrySummary {
  return {
    id: r.id,
    title: r.title,
    type: r.type ?? "note",
    url: r.url || undefined,
    content: r.content || undefined,
    imageUrl: r.imageUrl || undefined,
    faviconUrl: r.faviconUrl || undefined,
    siteName: r.siteName || undefined,
    updatedAt: r.updatedAt,
  }
}

export async function listResearchRecords(projectId: string): Promise<ResearchEntryRecord[]> {
  return db().researchEntries.where("projectId").equals(projectId).toArray()
}

/** Most recently touched first. */
export async function listResearchEntriesForProject(projectId: string): Promise<SerializedResearchEntrySummary[]> {
  const all = await listResearchRecords(projectId)
  return all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(serializeResearchEntrySummary)
}

export async function getResearchEntry(projectId: string, id: string): Promise<SerializedResearchEntry | null> {
  const r = await db().researchEntries.get(id)
  if (!r || r.projectId !== projectId) return null
  return { ...serializeResearchEntrySummary(r), projectId, createdAt: r.createdAt }
}

export async function createResearchEntry(
  projectId: string,
  fields: Partial<Omit<ResearchEntryRecord, "id" | "projectId" | "createdAt" | "updatedAt">> & {
    title: string
    type: ResearchEntryType
  }
): Promise<SerializedResearchEntrySummary | null> {
  if (!(await isActiveProject(projectId))) return null
  const now = nowIso()
  const record: ResearchEntryRecord = {
    url: "",
    content: "",
    imageUrl: "",
    faviconUrl: "",
    siteName: "",
    ...fields,
    id: newId(),
    projectId,
    createdAt: now,
    updatedAt: now,
  }
  await db().researchEntries.add(record)
  return serializeResearchEntrySummary(record)
}

export async function updateResearchEntry(
  projectId: string,
  id: string,
  fields: Partial<Pick<ResearchEntryRecord, "title" | "content" | "url" | "type">>
): Promise<boolean> {
  if (!(await isActiveProject(projectId))) return false
  const r = await db().researchEntries.get(id)
  if (!r || r.projectId !== projectId) return false
  await db().researchEntries.update(id, { ...fields, updatedAt: nowIso() })
  return true
}

export async function deleteResearchEntry(projectId: string, id: string): Promise<boolean> {
  if (!(await isActiveProject(projectId))) return false
  const r = await db().researchEntries.get(id)
  if (!r || r.projectId !== projectId) return false
  await db().researchEntries.delete(id)
  return true
}
