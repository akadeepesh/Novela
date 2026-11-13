import type { CharacterRole } from "@/lib/character-config"
import type { PlotStatus } from "@/lib/plot-config"
import type { CharacterPronouns, CharacterStatus, StoryCheckSettings } from "@/lib/store/db"

/**
 * Story Check: deterministic continuity rules over the manuscript and the
 * story bible. No AI and no network; everything here is plain functions,
 * so it can run in a Web Worker and be unit-tested with fixture text.
 */

export type RuleId = "fact-conflict" | "dead-appears" | "name-drift" | "forgotten" | "open-thread" | "timeline"

export const RULES: Record<RuleId, { label: string; description: string }> = {
  "fact-conflict": {
    label: "Character facts",
    description: "Eye or hair colour in the text that differs from the character's profile.",
  },
  "dead-appears": {
    label: "Dead characters",
    description: "A character marked dead speaks or acts in a later chapter.",
  },
  "name-drift": {
    label: "Name spelling",
    description: "A name that looks like a misspelling of a character or place.",
  },
  forgotten: {
    label: "Forgotten characters",
    description: "A main or supporting character who hasn't appeared for many chapters.",
  },
  "open-thread": {
    label: "Open plot threads",
    description: "Plot threads that are never resolved, or drop out of the end of the book.",
  },
  timeline: {
    label: "Ages and dates",
    description: "A stated age that doesn't match the birth year and the chapter's date.",
  },
}

export type CheckChapter = {
  id: string
  title: string
  order: number
  /** Tiptap/ProseMirror JSON. */
  content: unknown
  flashback?: boolean
  storyDate?: string
}

export type CheckCharacter = {
  id: string
  name: string
  aliases: string[]
  role: CharacterRole
  eyeColor?: string
  hairColor?: string
  birthYear?: number
  pronouns?: CharacterPronouns
  status?: CharacterStatus
  statusChapterId?: string
}

export type CheckPlace = { id: string; name: string; aliases: string[] }

export type CheckThread = {
  id: string
  title: string
  aliases: string[]
  status: PlotStatus
  resolvedChapterId?: string
}

export type StoryCheckInput = {
  /** Live chapters, in reading order. */
  chapters: CheckChapter[]
  characters: CheckCharacter[]
  places: CheckPlace[]
  threads: CheckThread[]
  settings: StoryCheckSettings
}

export type Severity = "warning" | "info"

export type Issue = {
  /** Stable identity, so "Ignore" keeps working as the text around it changes. */
  key: string
  rule: RuleId
  severity: Severity
  message: string
  /** The character, place or thread the issue is about (for "ignore this rule for…"). */
  entity?: { id: string; name: string; kind: "character" | "place" | "thread" }
  /** Where to look: a chapter, and optionally the passage in it. */
  location?: { chapterId: string; chapterTitle: string; blockIndex?: number; quote?: string }
}

export const DEFAULT_STORY_CHECK_SETTINGS: StoryCheckSettings = {
  forgottenAfterChapters: 8,
  ignoredIssues: [],
  ignoredRules: {},
  ignoredNames: [],
}
