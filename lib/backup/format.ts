import JSZip from "jszip"
import {
  db,
  SCHEMA_VERSION,
  type AssetRecord,
  type ChapterRecord,
  type CharacterRecord,
  type CommentRecord,
  type NoteRecord,
  type PlotThreadRecord,
  type ProjectRecord,
  type ResearchEntryRecord,
  type VersionRecord,
  type WorldEntryRecord,
  type WritingLogRecord,
} from "@/lib/store/db"
import { APP_NAME } from "@/lib/brand"

/**
 * Project files and full backups share one format: a zip holding
 *
 *   manifest.json   what this file is (see BackupManifest)
 *   data.json       every record, table by table (BackupData)
 *   assets/<id>     each stored image, as raw bytes
 *
 * Records are written exactly as stored, ids included, so restoring a
 * backup into an empty browser gives back the same data with the same ids.
 */

export const BACKUP_FORMAT = "korakagaj-backup"
/** Bump when the zip layout or data.json shape changes. */
export const BACKUP_FORMAT_VERSION = 1

export type BackupKind = "project" | "full"

export type BackupManifest = {
  format: typeof BACKUP_FORMAT
  formatVersion: number
  /** The database schema version the records were written with. */
  schemaVersion: number
  kind: BackupKind
  app: string
  exportedAt: string
  projects: { id: string; title: string }[]
}

/** An image record without its bytes (those live under assets/). */
type AssetMeta = Omit<AssetRecord, "blob">

export type BackupData = {
  projects: ProjectRecord[]
  chapters: ChapterRecord[]
  versions: VersionRecord[]
  characters: CharacterRecord[]
  worldEntries: WorldEntryRecord[]
  plotThreads: PlotThreadRecord[]
  notes: NoteRecord[]
  researchEntries: ResearchEntryRecord[]
  comments: CommentRecord[]
  assets: AssetMeta[]
  writingLog: WritingLogRecord[]
}

/** Every table that belongs to a project, i.e. has a `projectId`. */
const CHILD_TABLES = [
  "chapters",
  "versions",
  "characters",
  "worldEntries",
  "plotThreads",
  "notes",
  "researchEntries",
  "comments",
  "assets",
  "writingLog",
] as const

type ChildTable = (typeof CHILD_TABLES)[number]

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

/** Reads the given projects (or every project, Trash included) and everything in them. */
async function collect(projectIds?: string[]): Promise<{ data: BackupData; blobs: Map<string, Blob> }> {
  const d = db()
  return d.transaction("r", [d.projects, ...CHILD_TABLES.map((t) => d[t])], async () => {
    const projects = projectIds
      ? (await d.projects.bulkGet(projectIds)).filter((p): p is ProjectRecord => Boolean(p))
      : await d.projects.toArray()
    const ids = projects.map((p) => p.id)
    const byProject = <T,>(table: ChildTable) =>
      d[table].where("projectId").anyOf(ids).toArray() as unknown as Promise<T[]>

    const [chapters, versions, characters, worldEntries, plotThreads, notes, researchEntries, comments, assets, writingLog] =
      await Promise.all([
        byProject<ChapterRecord>("chapters"),
        byProject<VersionRecord>("versions"),
        byProject<CharacterRecord>("characters"),
        byProject<WorldEntryRecord>("worldEntries"),
        byProject<PlotThreadRecord>("plotThreads"),
        byProject<NoteRecord>("notes"),
        byProject<ResearchEntryRecord>("researchEntries"),
        byProject<CommentRecord>("comments"),
        byProject<AssetRecord>("assets"),
        byProject<WritingLogRecord>("writingLog"),
      ])

    const blobs = new Map(assets.map((a) => [a.id, a.blob]))
    const assetMeta: AssetMeta[] = assets.map((a) => ({
      id: a.id,
      projectId: a.projectId,
      type: a.type,
      size: a.size,
      createdAt: a.createdAt,
    }))
    return {
      data: { projects, chapters, versions, characters, worldEntries, plotThreads, notes, researchEntries, comments, assets: assetMeta, writingLog },
      blobs,
    }
  })
}

/**
 * Builds a backup file. With `projectIds` it holds just those projects (a
 * project file); without, every project in this browser (a full backup).
 */
export async function createBackup(kind: BackupKind, projectIds?: string[]): Promise<Blob> {
  const { data, blobs } = await collect(kind === "full" ? undefined : projectIds)
  const manifest: BackupManifest = {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    schemaVersion: SCHEMA_VERSION,
    kind,
    app: APP_NAME,
    exportedAt: new Date().toISOString(),
    projects: data.projects.map((p) => ({ id: p.id, title: p.title })),
  }
  const zip = new JSZip()
  zip.file("manifest.json", JSON.stringify(manifest, null, 2))
  zip.file("data.json", JSON.stringify(data))
  for (const [id, blob] of blobs) zip.file(`assets/${id}`, blob)
  return zip.generateAsync({ type: "blob", mimeType: "application/zip", compression: "DEFLATE" })
}

// ---------------------------------------------------------------------------
// Reading a file
// ---------------------------------------------------------------------------

export class BackupError extends Error {}

export type ParsedBackup = {
  manifest: BackupManifest
  data: BackupData
  blobs: Map<string, Blob>
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

function checkTable(data: Record<string, unknown>, table: string, projectIds: Set<string>) {
  const rows = data[table]
  if (!Array.isArray(rows)) throw new BackupError(`The file is missing its ${table}.`)
  for (const row of rows) {
    if (!isObject(row) || typeof row.id !== "string" || !row.id) throw new BackupError("The file has a damaged record.")
    if (table !== "projects" && (typeof row.projectId !== "string" || !projectIds.has(row.projectId))) {
      throw new BackupError("The file has a record that belongs to no book in it.")
    }
  }
}

/**
 * Brings records written by an older schema up to the current one. Add a
 * step here whenever SCHEMA_VERSION goes up and old records need changing.
 */
function migrateData(data: BackupData, fromSchema: number): BackupData {
  void fromSchema
  return data
}

/** Opens and checks a project file or backup. Throws BackupError with a readable message. */
export async function readBackup(file: Blob): Promise<ParsedBackup> {
  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(file)
  } catch {
    throw new BackupError(`This isn't a ${APP_NAME} project file or backup.`)
  }
  const manifestFile = zip.file("manifest.json")
  const dataFile = zip.file("data.json")
  if (!manifestFile || !dataFile) throw new BackupError(`This isn't a ${APP_NAME} project file or backup.`)

  let manifest: unknown
  let raw: unknown
  try {
    manifest = JSON.parse(await manifestFile.async("string"))
    raw = JSON.parse(await dataFile.async("string"))
  } catch {
    throw new BackupError("The file is damaged and can't be read.")
  }
  if (!isObject(manifest) || manifest.format !== BACKUP_FORMAT) {
    throw new BackupError(`This isn't a ${APP_NAME} project file or backup.`)
  }
  if (typeof manifest.formatVersion !== "number" || manifest.formatVersion > BACKUP_FORMAT_VERSION ||
      typeof manifest.schemaVersion !== "number" || manifest.schemaVersion > SCHEMA_VERSION) {
    throw new BackupError(`This file was made by a newer version of ${APP_NAME}. Reload the app to update it, then try again.`)
  }
  if (!isObject(raw)) throw new BackupError("The file is damaged and can't be read.")
  // Files from before daily goals (schema 3) have no writing log.
  if (manifest.schemaVersion < 3 && raw.writingLog === undefined) raw.writingLog = []

  checkTable(raw, "projects", new Set())
  const projectIds = new Set((raw.projects as { id: string }[]).map((p) => p.id))
  for (const table of CHILD_TABLES) checkTable(raw, table, projectIds)

  const data = migrateData(raw as unknown as BackupData, manifest.schemaVersion)
  const blobs = new Map<string, Blob>()
  for (const asset of data.assets) {
    const entry = zip.file(`assets/${asset.id}`)
    if (entry) blobs.set(asset.id, new Blob([await entry.async("arraybuffer")], { type: asset.type }))
  }
  return { manifest: manifest as unknown as BackupManifest, data, blobs }
}

// ---------------------------------------------------------------------------
// Importing
// ---------------------------------------------------------------------------

/**
 * What to do with a book whose id is already in this browser:
 *  - "replace": delete the existing book and everything in it, then restore
 *    the one from the file (same ids);
 *  - "copy": keep both; the incoming book gets fresh ids throughout.
 */
export type ConflictChoice = "replace" | "copy"

/** Which of the file's books already exist here. */
export async function findConflicts(backup: ParsedBackup): Promise<{ id: string; title: string }[]> {
  const existing = await db().projects.bulkGet(backup.data.projects.map((p) => p.id))
  return backup.data.projects.filter((_, i) => existing[i]).map((p) => ({ id: p.id, title: p.title }))
}

/** Every id inside one project's records. */
function idsOf(data: BackupData, projectId: string): string[] {
  const ids = [projectId]
  for (const table of CHILD_TABLES) {
    for (const row of data[table] as { id: string; projectId: string }[]) {
      if (row.projectId === projectId) ids.push(row.id)
    }
  }
  return ids
}

/**
 * Deep-copies `value`, swapping every string that is exactly an old id (or
 * `asset:<old id>`) for its new one. Ids are random UUIDs, so an exact match
 * can only be a reference: record ids, projectId/chapterId fields, @mention
 * and comment ids inside chapter text, and image references.
 */
function remap<T>(value: T, ids: Map<string, string>): T {
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") {
      const direct = ids.get(v)
      if (direct) return direct
      if (v.startsWith("asset:")) {
        const asset = ids.get(v.slice(6))
        if (asset) return `asset:${asset}`
      }
      return v
    }
    if (Array.isArray(v)) return v.map(walk)
    if (isObject(v)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]))
    return v
  }
  return walk(value) as T
}

function pick(data: BackupData, projectId: string): BackupData {
  const out = { projects: data.projects.filter((p) => p.id === projectId) } as BackupData
  for (const table of CHILD_TABLES) {
    ;(out as Record<string, unknown>)[table] = (data[table] as { projectId: string }[]).filter(
      (r) => r.projectId === projectId
    )
  }
  return out
}

export type ImportResult = { imported: { id: string; title: string }[] }

/**
 * Writes a parsed file into the database. Books that don't exist here are
 * restored as they are; books that do follow `onConflict`. Each book is
 * written in one transaction, so a failure never leaves half a book.
 */
export async function importBackup(backup: ParsedBackup, onConflict: ConflictChoice): Promise<ImportResult> {
  const d = db()
  const conflicts = new Set((await findConflicts(backup)).map((c) => c.id))
  const imported: ImportResult["imported"] = []

  for (const project of backup.data.projects) {
    let part = pick(backup.data, project.id)
    const blobs = new Map<string, Blob>()
    for (const a of part.assets) {
      const blob = backup.blobs.get(a.id)
      if (blob) blobs.set(a.id, blob)
    }

    const isConflict = conflicts.has(project.id)
    if (isConflict && onConflict === "copy") {
      const ids = new Map(idsOf(backup.data, project.id).map((id) => [id, crypto.randomUUID()]))
      part = remap(part, ids)
      for (const [oldId, blob] of [...blobs]) {
        blobs.delete(oldId)
        blobs.set(ids.get(oldId)!, blob)
      }
      part.projects[0] = { ...part.projects[0], title: `${part.projects[0].title} (copy)` }
    }

    const newProject = part.projects[0]
    await d.transaction("rw", [d.projects, ...CHILD_TABLES.map((t) => d[t])], async () => {
      if (isConflict && onConflict === "replace") {
        for (const table of CHILD_TABLES) await d[table].where("projectId").equals(project.id).delete()
        await d.projects.delete(project.id)
      }
      await d.projects.put(newProject)
      await d.chapters.bulkPut(part.chapters)
      await d.versions.bulkPut(part.versions)
      await d.characters.bulkPut(part.characters)
      await d.worldEntries.bulkPut(part.worldEntries)
      await d.plotThreads.bulkPut(part.plotThreads)
      await d.notes.bulkPut(part.notes)
      await d.researchEntries.bulkPut(part.researchEntries)
      await d.comments.bulkPut(part.comments)
      await d.writingLog.bulkPut(part.writingLog)
      // An image whose bytes are missing from the file is skipped; the cover
      // or background then falls back to the default, like a removed image.
      await d.assets.bulkPut(
        part.assets.flatMap((a) => {
          const blob = blobs.get(a.id)
          return blob ? [{ ...a, blob }] : []
        })
      )
    })
    imported.push({ id: newProject.id, title: newProject.title })
  }
  return { imported }
}
