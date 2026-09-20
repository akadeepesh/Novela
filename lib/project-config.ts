import type { Icon } from "@phosphor-icons/react"
import {
  BookOpenIcon,
  CompassIcon,
  ExportIcon,
  GlobeHemisphereWestIcon,
  MagnifyingGlassIcon,
  NotePencilIcon,
  PuzzlePieceIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react/dist/ssr"

export const PROJECT_TYPES = [
  {
    value: "novel",
    label: "Novel",
    description: "A single long-form story, told in chapters.",
  },
  {
    value: "poetry",
    label: "Poetry collection",
    description: "A collection of poems, grouped however you like.",
  },
  {
    value: "short-stories",
    label: "Short story collection",
    description: "Several standalone stories under one cover.",
  },
  {
    value: "nonfiction",
    label: "Non-fiction / memoir",
    description: "Structured sections rather than a fictional plot.",
  },
  {
    value: "custom",
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
  custom: "Chapters",
}

// Singular form of the above — kept as its own map rather than derived by
// stripping a trailing "s", which mangles "Stories" into "Storie".
export const CHAPTER_LABEL_SINGULAR: Record<ProjectType, string> = {
  novel: "Chapter",
  poetry: "Poem",
  "short-stories": "Story",
  nonfiction: "Chapter",
  custom: "Chapter",
}

// Sections always included, per type, before any optional story-bible add-ons.
const BASE_SECTIONS: Record<ProjectType, SectionId[]> = {
  novel: ["overview", "chapters", "characters", "world", "plot", "notes", "research", "export"],
  poetry: ["overview", "chapters", "notes", "export"],
  "short-stories": ["overview", "chapters", "notes", "research", "export"],
  nonfiction: ["overview", "chapters", "research", "notes", "export"],
  custom: ["overview", "chapters", "notes", "export"],
}

// Types where the story bible (characters/world/plot) is optional rather
// than automatic — the creation form surfaces a checkbox for these.
export const STORY_BIBLE_OPTIONAL_TYPES: ProjectType[] = ["poetry", "short-stories", "custom"]

/**
 * Computes the ordered section list for a new project. Result is stored
 * on the project itself (`sections`) rather than recomputed on every
 * render, so a project's structure stays stable even if these presets
 * change later.
 */
export function getDefaultSections(type: ProjectType, includeStoryBible: boolean): SectionId[] {
  const base = BASE_SECTIONS[type]
  if (!includeStoryBible || !STORY_BIBLE_OPTIONAL_TYPES.includes(type)) return base

  const withBible = [...base]
  const exportIndex = withBible.indexOf("export")
  const insertAt = exportIndex === -1 ? withBible.length : exportIndex
  withBible.splice(insertAt, 0, "characters", "world", "plot")
  return withBible
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
