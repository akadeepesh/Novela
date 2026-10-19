/** Colour tags for chapters on the outline board ("" = none). */
export const CHAPTER_LABELS = ["", "red", "orange", "yellow", "green", "blue", "purple"] as const
export type ChapterLabel = (typeof CHAPTER_LABELS)[number]

export const CHAPTER_LABEL_COLOR: Record<Exclude<ChapterLabel, "">, string> = {
  red: "oklch(0.63 0.19 25)",
  orange: "oklch(0.72 0.16 55)",
  yellow: "oklch(0.83 0.15 90)",
  green: "oklch(0.68 0.14 150)",
  blue: "oklch(0.62 0.14 250)",
  purple: "oklch(0.58 0.16 305)",
}

export const CHAPTER_STATUSES = ["draft", "in-progress", "done"] as const
export type ChapterStatus = (typeof CHAPTER_STATUSES)[number]

export const CHAPTER_STATUS_LABEL: Record<ChapterStatus, string> = {
  draft: "Draft",
  "in-progress": "In progress",
  done: "Done",
}
