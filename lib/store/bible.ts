import {
  db,
  newId,
  nowIso,
  type CharacterPronouns,
  type CharacterRecord,
  type CharacterStatus,
  type PlotThreadRecord,
  type WorldEntryRecord,
} from "./db"
import { isActiveProject } from "./projects"
import type { CharacterRole } from "@/lib/character-config"
import type { WorldEntryType } from "@/lib/world-config"
import type { PlotStatus } from "@/lib/plot-config"

/** Story bible: characters, world entries and plot threads. */

const byText = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: "base" })

/** Fields the forms write. Unlisted text fields are stored as empty strings. */
type Editable<R> = Omit<R, "id" | "projectId" | "createdAt" | "updatedAt">

async function insert<R extends { id: string; projectId: string; createdAt: string; updatedAt: string }>(
  table: "characters" | "worldEntries" | "plotThreads",
  projectId: string,
  fields: Editable<R>
): Promise<string | null> {
  if (!(await isActiveProject(projectId))) return null
  const now = nowIso()
  const id = newId()
  await (db()[table] as unknown as { add: (r: unknown) => Promise<unknown> }).add({
    ...fields,
    id,
    projectId,
    createdAt: now,
    updatedAt: now,
  })
  return id
}

async function patch(
  table: "characters" | "worldEntries" | "plotThreads",
  projectId: string,
  id: string,
  fields: Record<string, unknown>
): Promise<boolean> {
  if (!(await isActiveProject(projectId))) return false
  const t = db()[table]
  const r = await t.get(id)
  if (!r || r.projectId !== projectId) return false
  await t.update(id, { ...fields, updatedAt: nowIso() })
  return true
}

async function remove(table: "characters" | "worldEntries" | "plotThreads", projectId: string, id: string): Promise<boolean> {
  if (!(await isActiveProject(projectId))) return false
  const t = db()[table]
  const r = await t.get(id)
  if (!r || r.projectId !== projectId) return false
  await t.delete(id)
  return true
}

// ---------------------------------------------------------------------------
// Characters
// ---------------------------------------------------------------------------

export type SerializedCharacterSummary = {
  id: string
  name: string
  role: CharacterRole
  imageUrl?: string
  appearance?: string
}

export type SerializedCharacter = SerializedCharacterSummary & {
  projectId: string
  aliases: string[]
  personality?: string
  backstory?: string
  notes?: string
  eyeColor?: string
  hairColor?: string
  birthYear?: number
  pronouns?: CharacterPronouns
  status?: CharacterStatus
  statusChapterId?: string
  createdAt: string
  updatedAt: string
}

export type CharacterFields = Editable<CharacterRecord>

function characterSummary(c: CharacterRecord): SerializedCharacterSummary {
  return {
    id: c.id,
    name: c.name,
    role: c.role ?? "supporting",
    imageUrl: c.imageUrl || undefined,
    appearance: c.appearance || undefined,
  }
}

export async function listCharacterRecords(projectId: string): Promise<CharacterRecord[]> {
  const all = await db().characters.where("projectId").equals(projectId).toArray()
  return all.sort((a, b) => byText(a.name, b.name))
}

export async function listCharactersForProject(projectId: string): Promise<SerializedCharacterSummary[]> {
  return (await listCharacterRecords(projectId)).map(characterSummary)
}

export async function getCharacter(projectId: string, id: string): Promise<SerializedCharacter | null> {
  const c = await db().characters.get(id)
  if (!c || c.projectId !== projectId) return null
  return {
    ...characterSummary(c),
    projectId,
    aliases: c.aliases ?? [],
    personality: c.personality || undefined,
    backstory: c.backstory || undefined,
    notes: c.notes || undefined,
    eyeColor: c.eyeColor || undefined,
    hairColor: c.hairColor || undefined,
    birthYear: c.birthYear || undefined,
    pronouns: c.pronouns || undefined,
    status: c.status || undefined,
    statusChapterId: c.statusChapterId || undefined,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  }
}

export const createCharacter = (projectId: string, fields: CharacterFields) =>
  insert<CharacterRecord>("characters", projectId, fields)
export const updateCharacter = (projectId: string, id: string, fields: Partial<CharacterFields>) =>
  patch("characters", projectId, id, fields)
export const deleteCharacter = (projectId: string, id: string) => remove("characters", projectId, id)

// ---------------------------------------------------------------------------
// World entries
// ---------------------------------------------------------------------------

export type SerializedWorldEntrySummary = {
  id: string
  name: string
  type: WorldEntryType
  imageUrl?: string
  description?: string
}

export type SerializedWorldEntry = SerializedWorldEntrySummary & {
  projectId: string
  aliases: string[]
  notes?: string
  createdAt: string
  updatedAt: string
}

export type WorldEntryFields = Editable<WorldEntryRecord>

function worldSummary(w: WorldEntryRecord): SerializedWorldEntrySummary {
  return {
    id: w.id,
    name: w.name,
    type: w.type ?? "location",
    imageUrl: w.imageUrl || undefined,
    description: w.description || undefined,
  }
}

export async function listWorldEntryRecords(projectId: string): Promise<WorldEntryRecord[]> {
  const all = await db().worldEntries.where("projectId").equals(projectId).toArray()
  return all.sort((a, b) => byText(a.name, b.name))
}

export async function listWorldEntriesForProject(projectId: string): Promise<SerializedWorldEntrySummary[]> {
  return (await listWorldEntryRecords(projectId)).map(worldSummary)
}

export async function getWorldEntry(projectId: string, id: string): Promise<SerializedWorldEntry | null> {
  const w = await db().worldEntries.get(id)
  if (!w || w.projectId !== projectId) return null
  return {
    ...worldSummary(w),
    projectId,
    aliases: w.aliases ?? [],
    notes: w.notes || undefined,
    createdAt: w.createdAt,
    updatedAt: w.updatedAt,
  }
}

export const createWorldEntry = (projectId: string, fields: WorldEntryFields) =>
  insert<WorldEntryRecord>("worldEntries", projectId, fields)
export const updateWorldEntry = (projectId: string, id: string, fields: Partial<WorldEntryFields>) =>
  patch("worldEntries", projectId, id, fields)
export const deleteWorldEntry = (projectId: string, id: string) => remove("worldEntries", projectId, id)

// ---------------------------------------------------------------------------
// Plot threads
// ---------------------------------------------------------------------------

export type SerializedPlotThreadSummary = {
  id: string
  title: string
  status: PlotStatus
  description?: string
  updatedAt: string
}

export type SerializedPlotThread = SerializedPlotThreadSummary & {
  projectId: string
  aliases: string[]
  notes?: string
  resolvedChapterId?: string
  createdAt: string
}

export type PlotThreadFields = Editable<PlotThreadRecord>

function plotSummary(p: PlotThreadRecord): SerializedPlotThreadSummary {
  return {
    id: p.id,
    title: p.title,
    status: p.status ?? "planned",
    description: p.description || undefined,
    updatedAt: p.updatedAt,
  }
}

export async function listPlotThreadRecords(projectId: string): Promise<PlotThreadRecord[]> {
  const all = await db().plotThreads.where("projectId").equals(projectId).toArray()
  return all.sort((a, b) => byText(a.title, b.title))
}

export async function listPlotThreadsForProject(projectId: string): Promise<SerializedPlotThreadSummary[]> {
  return (await listPlotThreadRecords(projectId)).map(plotSummary)
}

export async function getPlotThread(projectId: string, id: string): Promise<SerializedPlotThread | null> {
  const p = await db().plotThreads.get(id)
  if (!p || p.projectId !== projectId) return null
  return {
    ...plotSummary(p),
    projectId,
    aliases: p.aliases ?? [],
    notes: p.notes || undefined,
    resolvedChapterId: p.resolvedChapterId || undefined,
    createdAt: p.createdAt,
  }
}

export const createPlotThread = (projectId: string, fields: PlotThreadFields) =>
  insert<PlotThreadRecord>("plotThreads", projectId, fields)
export const updatePlotThread = (projectId: string, id: string, fields: Partial<PlotThreadFields>) =>
  patch("plotThreads", projectId, id, fields)
export const deletePlotThread = (projectId: string, id: string) => remove("plotThreads", projectId, id)
