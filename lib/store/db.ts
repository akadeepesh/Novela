import Dexie, { type EntityTable } from "dexie"
import type { ProjectType, SectionId } from "@/lib/project-config"
import type { ManuscriptSettings } from "@/lib/manuscript-config"
import type { ChapterNumberingStyle } from "@/lib/chapter-numbering"
import type { TrimSizeId } from "@/lib/export-config"
import type { ChapterLabel } from "@/lib/chapter-config"
import type { CharacterRole } from "@/lib/character-config"
import type { WorldEntryType } from "@/lib/world-config"
import type { PlotStatus } from "@/lib/plot-config"
import type { ResearchEntryType } from "@/lib/research-config"

/**
 * The app's whole database, kept in the browser (IndexedDB). Nothing here
 * is ever sent to a server.
 *
 * Records keep the same fields the old MongoDB models had, minus `ownerId`
 * (everything in this browser belongs to whoever is using it). Ids are
 * random UUID strings and every date is an ISO string, so a record can be
 * written to a backup file and read back without conversion.
 */

/** Bumped whenever the stored shape changes; see `migrations` below. */
export const SCHEMA_VERSION = 2

export type ChapterStatus = "draft" | "in-progress" | "done"
export type VersionKind = "auto" | "manual" | "restore-point"

export type ProjectRecord = {
  id: string
  title: string
  type: ProjectType
  genre?: string
  blurb?: string
  authorName?: string
  /** Either an `asset:<id>` reference to an image stored locally, or empty. */
  coverFrontUrl?: string
  coverBackUrl?: string
  chapterNumberingStyle: ChapterNumberingStyle
  chapterNumberingPrefix?: string
  exportTrimSize: TrimSizeId
  targetWordCount?: number
  dailyWordGoal: number
  /** Ordered list of enabled sidebar sections, fixed at creation. */
  sections: SectionId[]
  manuscriptSettings: ManuscriptSettings
  /** Story Check preferences and dismissed issues. Absent until first changed. */
  storyCheck?: StoryCheckSettings
  /** Print export choices (template, printer, paper, bleed, copyright page). */
  print?: PrintSettings
  createdAt: string
  updatedAt: string
  /** Set while the project is in the Trash. */
  deletedAt?: string
}

export type PrintSettings = {
  templateId: string
  printer: "kdp" | "ingramspark"
  paper: "white" | "cream"
  bleed: boolean
  /** The copyright page, as typed. Empty means the generated default. */
  copyrightText: string
}

export type StoryCheckSettings = {
  /** Flag a major or supporting character missing for this many chapters. */
  forgottenAfterChapters: number
  /** Keys of individual issues the writer dismissed. */
  ignoredIssues: string[]
  /** Rules switched off for one character, place or thread: entity id → rule ids. */
  ignoredRules: Record<string, string[]>
  /** Words the spelling-drift rule should never flag (real names that look like typos). */
  ignoredNames: string[]
}

export type ChapterRecord = {
  id: string
  projectId: string
  title: string
  /** Tiptap (ProseMirror) document JSON. */
  content: unknown
  order: number
  wordCount: number
  /** Bumped on every save; a save based on an older version is a conflict. */
  version: number
  /** sha256 of the content JSON, to tell whether the text really changed. */
  contentHash?: string
  lastSnapshotAt?: string
  status: ChapterStatus
  synopsis: string
  label: ChapterLabel
  /** Set chapters in the past; Story Check doesn't flag the dead appearing in them. */
  flashback?: boolean
  /** When the chapter takes place: "YYYY" or "YYYY-MM-DD". Used for age checks. */
  storyDate?: string
  createdAt: string
  updatedAt: string
  deletedAt?: string
}

export type VersionRecord = {
  id: string
  chapterId: string
  projectId: string
  title: string
  content: unknown
  wordCount: number
  contentHash?: string
  kind: VersionKind
  label?: string
  createdAt: string
}

export type CharacterRecord = {
  id: string
  projectId: string
  name: string
  role: CharacterRole
  aliases: string[]
  imageUrl: string
  appearance: string
  personality: string
  backstory: string
  notes: string
  /** Structured facts checked by Story Check. All optional. */
  eyeColor?: string
  hairColor?: string
  birthYear?: number
  pronouns?: CharacterPronouns
  status?: CharacterStatus
  /** The chapter from which `status` (dead, missing) applies. */
  statusChapterId?: string
  createdAt: string
  updatedAt: string
}

export type CharacterPronouns = "" | "she" | "he" | "they"
export type CharacterStatus = "" | "alive" | "dead" | "missing"

export type WorldEntryRecord = {
  id: string
  projectId: string
  name: string
  type: WorldEntryType
  aliases: string[]
  imageUrl: string
  description: string
  notes: string
  createdAt: string
  updatedAt: string
}

export type PlotThreadRecord = {
  id: string
  projectId: string
  title: string
  status: PlotStatus
  aliases: string[]
  description: string
  notes: string
  /** The chapter where this thread is resolved. */
  resolvedChapterId?: string
  createdAt: string
  updatedAt: string
}

export type NoteRecord = {
  id: string
  projectId: string
  title: string
  content: string
  tags: string[]
  pinned: boolean
  createdAt: string
  updatedAt: string
}

export type ResearchEntryRecord = {
  id: string
  projectId: string
  title: string
  type: ResearchEntryType
  url: string
  content: string
  imageUrl: string
  faviconUrl: string
  siteName: string
  createdAt: string
  updatedAt: string
}

/** The writer's own margin note on a passage of a chapter. */
export type CommentRecord = {
  id: string
  projectId: string
  chapterId: string
  body: string
  quote: string
  resolved: boolean
  createdAt: string
  updatedAt: string
}

/** An uploaded image (cover, background), stored as a Blob. */
export type AssetRecord = {
  id: string
  projectId: string
  blob: Blob
  type: string
  size: number
  createdAt: string
}

/** A print template imported from a template pack. File references point at `templateFiles`. */
export type TemplateRecord = {
  /** The template's own id, e.g. "fantasy/ornate". Importing again replaces it. */
  id: string
  /** The validated template JSON, with file references rewritten to `tplfile:<id>`. */
  template: import("@/lib/print/template").PrintTemplate
  packName: string
  packVersion?: string
  importedAt: string
}

/** A font or image file belonging to an imported template. */
export type TemplateFileRecord = {
  id: string
  templateId: string
  /** The file's path inside the pack, for messages. */
  path: string
  blob: Blob
  type: string
}

/** Small key/value settings and bookkeeping (e.g. last backup time). */
export type MetaRecord = { key: string; value: unknown }

export type AppDB = Dexie & {
  projects: EntityTable<ProjectRecord, "id">
  chapters: EntityTable<ChapterRecord, "id">
  versions: EntityTable<VersionRecord, "id">
  characters: EntityTable<CharacterRecord, "id">
  worldEntries: EntityTable<WorldEntryRecord, "id">
  plotThreads: EntityTable<PlotThreadRecord, "id">
  notes: EntityTable<NoteRecord, "id">
  researchEntries: EntityTable<ResearchEntryRecord, "id">
  comments: EntityTable<CommentRecord, "id">
  assets: EntityTable<AssetRecord, "id">
  meta: EntityTable<MetaRecord, "key">
  templates: EntityTable<TemplateRecord, "id">
  templateFiles: EntityTable<TemplateFileRecord, "id">
}

/**
 * Index definitions per schema version. Only indexed fields are listed;
 * every other field is stored too. To change the shape later, add a new
 * entry with the next version number and, if old records need rewriting,
 * an `upgrade` function. Never edit an entry that has shipped.
 */
const migrations: {
  version: number
  stores: Record<string, string>
  upgrade?: (tx: import("dexie").Transaction) => Promise<void>
}[] = [
  {
    version: 1,
    stores: {
      projects: "id, updatedAt",
      chapters: "id, projectId, updatedAt",
      versions: "id, chapterId, projectId, [chapterId+createdAt]",
      characters: "id, projectId",
      worldEntries: "id, projectId",
      plotThreads: "id, projectId",
      notes: "id, projectId",
      researchEntries: "id, projectId",
      comments: "id, chapterId, projectId",
      assets: "id, projectId",
      meta: "key",
    },
  },
  {
    // Imported print templates and their fonts and ornaments.
    version: 2,
    stores: {
      templates: "id",
      templateFiles: "id, templateId",
    },
  },
]

export const DB_NAME = "korakagaj"

let instance: AppDB | null = null

/** The database, opened on first use. Browser only. */
export function db(): AppDB {
  if (instance) return instance
  const d = new Dexie(DB_NAME) as AppDB
  for (const m of migrations) {
    const v = d.version(m.version).stores(m.stores)
    if (m.upgrade) v.upgrade(m.upgrade)
  }
  instance = d
  return d
}

/** A new random id for any record. */
export function newId(): string {
  return crypto.randomUUID()
}

export function nowIso(): string {
  return new Date().toISOString()
}
