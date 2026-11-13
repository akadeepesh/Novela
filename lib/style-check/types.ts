/**
 * Style checks: plain-text heuristics over one chapter (repeated words,
 * filler words, long sentences, adverbs, passive voice) plus chapter stats.
 * No AI and no network; every function here is pure, so it can be
 * unit-tested with fixture text.
 */

export type StyleRuleId = "repeat" | "filler" | "long-sentence" | "adverb" | "passive"

export const STYLE_RULES: Record<StyleRuleId, { label: string; description: string; color: string }> = {
  repeat: {
    label: "Repeated words",
    description: "The same word used again soon after, such as “looked … looked”.",
    color: "style-repeat",
  },
  filler: {
    label: "Filler words",
    description: "Words that usually add little, such as “just”, “really” or “started to”. Dialogue is skipped.",
    color: "style-filler",
  },
  "long-sentence": {
    label: "Long sentences",
    description: "Sentences longer than your limit.",
    color: "style-long",
  },
  adverb: {
    label: "Adverbs",
    description: "Words ending in “-ly” that often prop up a weaker verb. Dialogue is skipped.",
    color: "style-adverb",
  },
  passive: {
    label: "Passive voice",
    description: "“was taken”, “were seen”: the doer is hidden or comes last. A best guess. Dialogue is skipped.",
    color: "style-passive",
  },
}

export const STYLE_RULE_IDS = Object.keys(STYLE_RULES) as StyleRuleId[]

export const DEFAULT_FILLER_WORDS = [
  "just",
  "really",
  "very",
  "suddenly",
  "started to",
  "began to",
  "somehow",
  "actually",
  "basically",
  "quite",
  "rather",
  "simply",
  "totally",
  "literally",
  "seemed to",
  "a bit",
  "kind of",
  "sort of",
  "that said",
]

export type StyleSettings = {
  /** Checks switched on. */
  rules: Record<StyleRuleId, boolean>
  /** Words and short phrases flagged by the filler check, lower case. */
  fillerWords: string[]
  /** Flag sentences with more words than this. */
  maxSentenceWords: number
  /** Flag a word used again within this many words. */
  repeatWindow: number
  /** Underline findings in the editor. */
  highlights: boolean
  /** Keys of findings the writer dismissed. */
  ignored: string[]
}

export const DEFAULT_STYLE_SETTINGS: StyleSettings = {
  rules: { repeat: true, filler: true, "long-sentence": true, adverb: true, passive: true },
  fillerWords: DEFAULT_FILLER_WORDS,
  maxSentenceWords: 40,
  repeatWindow: 30,
  highlights: false,
  ignored: [],
}

/** Fills in anything missing from stored (possibly older) settings. */
export function withStyleDefaults(s: Partial<StyleSettings> | undefined): StyleSettings {
  return {
    ...DEFAULT_STYLE_SETTINGS,
    ...s,
    rules: { ...DEFAULT_STYLE_SETTINGS.rules, ...s?.rules },
  }
}

export type StyleFinding = {
  /** Stable identity, so "Ignore" survives edits elsewhere in the chapter. */
  key: string
  rule: StyleRuleId
  /** Which textblock, in document order (the numbering Story Check uses). */
  blockIndex: number
  /** [start, end) inside the block's text. */
  start: number
  end: number
  /** The flagged text itself. */
  quote: string
  message: string
}

/** A character the stats can credit dialogue to. */
export type StyleCharacter = { id: string; name: string; aliases: string[] }

export type ChapterStats = {
  words: number
  sentences: number
  /** Average words per sentence, rounded to one decimal. */
  avgSentenceWords: number
  longestSentenceWords: number
  /** Minutes at 250 words a minute, at least 1 for any text. */
  readingMinutes: number
  dialogueWords: number
  /** 0–1. */
  dialogueShare: number
  adverbsPer100: number
  /** Each character's dialogue words, most first. */
  speakers: { id: string; name: string; words: number }[]
  /** Dialogue words with no speaker found. */
  unattributedWords: number
}
