import type { Icon } from "@phosphor-icons/react"
import {
  BookOpenIcon,
  CompassIcon,
  ExportIcon,
  FeatherIcon,
  FilmSlateIcon,
  GlobeHemisphereWestIcon,
  MagnifyingGlassIcon,
  NotebookIcon,
  NotePencilIcon,
  PuzzlePieceIcon,
  SlidersHorizontalIcon,
  StackIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react/dist/ssr"

export const PROJECT_TYPES = [
  {
    value: "novel",
    shortLabel: "Novel",
    label: "Novel",
    description: "Long-form narrative with chapters — fiction, memoir, or non-fiction.",
  },
  {
    value: "poetry",
    shortLabel: "Poetry",
    label: "Poetry collection",
    description: "A collection of poems, grouped however you like.",
  },
  {
    value: "script-writing",
    shortLabel: "Script",
    label: "Script writing",
    description: "Scripts for YouTube, podcasts, or other spoken content — one script per episode.",
  },
  {
    value: "custom",
    shortLabel: "Custom",
    label: "Custom",
    description: "Start minimal and add sections as you need them.",
  },
] as const

export type ProjectType = (typeof PROJECT_TYPES)[number]["value"]

export const GENRES = [
  "Literary Fiction",
  "Fantasy",
  "Science Fiction",
  "Mystery & Crime",
  "Thriller & Suspense",
  "Romance",
  "Horror",
  "Historical Fiction",
  "Young Adult",
  "Memoir & Biography",
  "Essay & Nonfiction",
  "Poetry",
  "Other",
] as const

// Content-format options for script-writing projects — "genre" doesn't
// quite fit spoken/video content, so this swaps in for that field instead.
export const SCRIPT_FORMATS = [
  "Tutorial / How-To",
  "Vlog",
  "Educational / Explainer",
  "Commentary / Review",
  "Interview / Podcast",
  "Comedy / Entertainment",
  "Product / Unboxing",
  "Other",
] as const

export function genreFieldLabel(type: ProjectType): string {
  return type === "script-writing" ? "Format" : "Genre"
}

export function genreOptions(type: ProjectType): readonly string[] {
  return type === "script-writing" ? SCRIPT_FORMATS : GENRES
}

/**
 * Every possible sidebar section. `label` is a default — some project
 * types override it (e.g. "chapters" reads as "Poems" for a poetry
 * project) via CHAPTER_LABEL below.
 */
export const SECTION_DEFS = {
  overview: { label: "Overview", icon: CompassIcon },
  chapters: { label: "Chapters", icon: BookOpenIcon },
  characters: { label: "Characters", icon: UsersThreeIcon },
  world: { label: "World", icon: GlobeHemisphereWestIcon },
  plot: { label: "Plot", icon: PuzzlePieceIcon },
  notes: { label: "Notes", icon: NotePencilIcon },
  research: { label: "Research", icon: MagnifyingGlassIcon },
  export: { label: "Export", icon: ExportIcon },
} satisfies Record<string, { label: string; icon: Icon }>

export type SectionId = keyof typeof SECTION_DEFS

// How the "chapters" section is labeled per project type.
export const CHAPTER_LABEL: Record<ProjectType, string> = {
  novel: "Chapters",
  poetry: "Poems",
  "script-writing": "Scripts",
  custom: "Chapters",
}

// Singular form of the above — kept as its own map rather than derived by
// stripping a trailing "s", which mangles "Stories" into "Storie".
export const CHAPTER_LABEL_SINGULAR: Record<ProjectType, string> = {
  novel: "Chapter",
  poetry: "Poem",
  "script-writing": "Script",
  custom: "Chapter",
}

// Sections always included, per type, before any optional story-bible add-ons.
const BASE_SECTIONS: Record<ProjectType, SectionId[]> = {
  novel: ["overview", "chapters", "characters", "world", "plot", "notes", "research", "export"],
  poetry: ["overview", "chapters", "notes", "export"],
  "script-writing": ["overview", "chapters", "notes", "research", "export"],
  custom: ["overview", "chapters", "notes", "export"],
}

/**
 * Sections a project can bolt on after creation (via the sidebar's "Add
 * section"). Overview, chapters and export are structural — every
 * project has them from the start.
 */
export const ADDABLE_SECTIONS: SectionId[] = ["characters", "world", "plot", "notes", "research"]

/**
 * The ordered section list for a new project. Stored on the project
 * itself (`sections`) rather than recomputed on every render, so a
 * project's structure stays stable even if these presets change later.
 */
export function getDefaultSections(type: ProjectType): SectionId[] {
  return [...BASE_SECTIONS[type]]
}

export function sectionLabel(id: SectionId, type: ProjectType): string {
  if (id === "chapters") return CHAPTER_LABEL[type]
  return SECTION_DEFS[id].label
}

/** Singular form — "Poem" not "Poems" — for prompts like "New Poem" or "Untitled Story". */
export function sectionLabelSingular(id: SectionId, type: ProjectType): string {
  if (id === "chapters") return CHAPTER_LABEL_SINGULAR[type]
  const label = SECTION_DEFS[id].label
  return label.endsWith("s") ? label.slice(0, -1) : label
}

export function projectTypeLabel(type: ProjectType): string {
  return PROJECT_TYPES.find((t) => t.value === type)?.label ?? type
}

export function projectTypeShortLabel(type: ProjectType): string {
  return PROJECT_TYPES.find((t) => t.value === type)?.shortLabel ?? type
}

/** "Untitled Novel", "Untitled Script" — used as the placeholder and as the fallback title. */
export function defaultProjectTitle(type: ProjectType): string {
  return type === "custom" ? "Untitled Project" : `Untitled ${projectTypeShortLabel(type)}`
}

// A small icon for the project type itself — used on the dashboard and the
// creation canvas, where the section icons above don't apply.
export const PROJECT_TYPE_ICON: Record<ProjectType, Icon> = {
  novel: BookOpenIcon,
  poetry: FeatherIcon,
  "script-writing": FilmSlateIcon,
  custom: SlidersHorizontalIcon,
}

/**
 * Normalizes legacy project types to the current four-type system.
 * Short Stories and Non-fiction used the identical structure to Novel
 * (chapters, optional story-bible sections) — the only difference was
 * a label, not a type. This remaps them to "novel" on read.
 */
export function normalizeProjectType(type: string): ProjectType {
  if (type === "short-stories" || type === "nonfiction") {
    return "novel"
  }
  return type as ProjectType
}
