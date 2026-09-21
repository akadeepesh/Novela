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
    description: "A single long-form story, told in chapters.",
  },
  {
    value: "poetry",
    shortLabel: "Poetry",
    label: "Poetry collection",
    description: "A collection of poems, grouped however you like.",
  },
  {
    value: "short-stories",
    shortLabel: "Short Stories",
    label: "Short story collection",
    description: "Several standalone stories under one cover.",
  },
  {
    value: "nonfiction",
    shortLabel: "Non-fiction",
    label: "Non-fiction / memoir",
    description: "Structured sections rather than a fictional plot.",
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

// Types whose base sections don't already include Characters/World/Plot —
// for these, the "story bible" sections are offered as an opt-in checkbox
// at creation time instead of being included automatically. ("novel" is
// the only type that ships with them by default — see BASE_SECTIONS below.)
export const STORY_BIBLE_OPTIONAL_TYPES: ProjectType[] = PROJECT_TYPES.map(
  (t) => t.value
).filter((value) => value !== "novel")

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
  "short-stories": "Stories",
  nonfiction: "Chapters",
  "script-writing": "Scripts",
  custom: "Chapters",
}

// Singular form of the above — kept as its own map rather than derived by
// stripping a trailing "s", which mangles "Stories" into "Storie".
export const CHAPTER_LABEL_SINGULAR: Record<ProjectType, string> = {
  novel: "Chapter",
  poetry: "Poem",
  "short-stories": "Story",
  nonfiction: "Chapter",
  "script-writing": "Script",
  custom: "Chapter",
}

// Sections always included, per type, before any optional story-bible add-ons.
const BASE_SECTIONS: Record<ProjectType, SectionId[]> = {
  novel: ["overview", "chapters", "characters", "world", "plot", "notes", "research", "export"],
  poetry: ["overview", "chapters", "notes", "export"],
  "short-stories": ["overview", "chapters", "notes", "research", "export"],
  nonfiction: ["overview", "chapters", "research", "notes", "export"],
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
  "short-stories": StackIcon,
  nonfiction: NotebookIcon,
  "script-writing": FilmSlateIcon,
  custom: SlidersHorizontalIcon,
}
