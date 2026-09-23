// Part 4.2 — chapter numbering is a real per-book decision (how "1", "2",
// "3" should actually read to a reader) that wasn't exposed anywhere
// before. Lives on the project, applied wherever a chapter/poem/script
// title is shown to a reader (currently: export; Read View later).

export const CHAPTER_NUMBERING_STYLES = [
  { id: "numeral", label: "1, 2, 3", example: "1" },
  { id: "word", label: "Spelled out", example: "Chapter One" },
  { id: "custom", label: "Custom prefix", example: "Part 1" },
  { id: "none", label: "No numbering", example: "—" },
] as const

export type ChapterNumberingStyle = (typeof CHAPTER_NUMBERING_STYLES)[number]["id"]
export const CHAPTER_NUMBERING_STYLE_IDS = CHAPTER_NUMBERING_STYLES.map((s) => s.id)

const ONES = [
  "Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
]
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]

/**
 * Spells out 1–1999 ("Twenty-One", "One Hundred Two"). Falls back to the
 * plain numeral past that — no manuscript has 2000 chapters, and this is
 * only ever reached from a real chapter position.
 */
export function numberToWords(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > 1999) return String(n)
  if (n < 20) return ONES[n]
  if (n < 100) {
    const tens = TENS[Math.floor(n / 10)]
    const ones = n % 10
    return ones === 0 ? tens : `${tens}-${ONES[ones]}`
  }
  if (n < 1000) {
    const hundreds = Math.floor(n / 100)
    const rest = n % 100
    return rest === 0 ? `${ONES[hundreds]} Hundred` : `${ONES[hundreds]} Hundred ${numberToWords(rest)}`
  }
  const thousands = Math.floor(n / 1000)
  const rest = n % 1000
  return rest === 0 ? `${ONES[thousands]} Thousand` : `${ONES[thousands]} Thousand ${numberToWords(rest)}`
}

/**
 * Builds the number label for one chapter — "Chapter One", "1", "Part 3",
 * or nothing at all — or `undefined` for style "none", meaning: don't show
 * a number, just the title.
 */
export function chapterNumberLabel({
  style,
  prefix,
  index,
  singular,
}: {
  style: string
  prefix?: string
  /** 0-based position within the manuscript. */
  index: number
  /** "Chapter" / "Poem" / "Script", per project type. */
  singular: string
}): string | undefined {
  const n = index + 1
  switch (style) {
    case "none":
      return undefined
    case "numeral":
      return String(n)
    case "custom":
      return `${(prefix ?? "").trim() || singular} ${n}`
    case "word":
      return `${singular} ${numberToWords(n)}`
    default:
      return String(n)
  }
}
