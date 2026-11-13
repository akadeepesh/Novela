/**
 * Print-on-demand rules for Amazon KDP and IngramSpark paperbacks: margins
 * by page count, bleed, page geometry for mirrored margins, and spine width.
 *
 * Sources (checked 2026): KDP Help "Set trim size, bleed, and margins" and
 * "Create a paperback cover"; IngramSpark File Creation Guide. Minimums are
 * requirements; the design margins of each trim size sit above them.
 */

import { getTrimSize } from "@/lib/export-config"

export const POINTS_PER_INCH = 72

/** Extra paper beyond the trim on the outside, top and bottom edges when printing to the edge. */
export const BLEED_IN = 0.125

export type Printer = "kdp" | "ingramspark"
export type Paper = "white" | "cream"

export const PRINTERS: { id: Printer; label: string }[] = [
  { id: "kdp", label: "Amazon KDP" },
  { id: "ingramspark", label: "IngramSpark" },
]

export const PAPERS: { id: Paper; label: string }[] = [
  { id: "cream", label: "Cream paper" },
  { id: "white", label: "White paper" },
]

/** KDP's page-count limits for black-and-white paperbacks. */
export const MIN_PAGES = 24
export const MAX_PAGES = 828

/**
 * KDP's minimum inside (gutter) margin for a page count: the thicker the
 * book, the more paper disappears into the binding.
 */
export function minimumGutterIn(pageCount: number): number {
  if (pageCount <= 150) return 0.375
  if (pageCount <= 300) return 0.5
  if (pageCount <= 500) return 0.625
  if (pageCount <= 700) return 0.75
  return 0.875
}

/** Minimum outside, top and bottom margin. IngramSpark asks for at least 0.5 in everywhere. */
export function minimumOuterIn(printer: Printer, bleed: boolean): number {
  if (printer === "ingramspark") return 0.5
  return bleed ? 0.375 : 0.25
}

export type PageGeometry = {
  /** The printed page in points, including bleed. */
  pageWidth: number
  pageHeight: number
  /** Margins in inches, after applying the printer's minimums. */
  margins: { inside: number; outside: number; top: number; bottom: number }
  /** Symmetric padding to lay out with (points); mirrored by shifting each page afterwards. */
  padding: { top: number; bottom: number; horizontal: number }
  /** Horizontal shift (points) for right-hand (odd) and left-hand (even) pages. */
  shift: { recto: number; verso: number }
  /** Width of the text block in points: the same on every page. */
  textWidth: number
  bleed: boolean
  trim: { widthIn: number; heightIn: number }
}

/**
 * Lays out a page for `pageCount` pages on `trimSizeId`. Text is laid out
 * with symmetric padding and then shifted: right-hand pages towards the
 * outside, left-hand pages the other way, so the gutter is always on the
 * spine side (mirrored margins). With bleed, the extra paper is on the
 * outside, top and bottom.
 */
export function pageGeometry(opts: { trimSizeId: string; pageCount: number; printer: Printer; bleed: boolean }): PageGeometry {
  const trim = getTrimSize(opts.trimSizeId)
  const minOuter = minimumOuterIn(opts.printer, opts.bleed)
  const minGutter = Math.max(minimumGutterIn(opts.pageCount), opts.printer === "ingramspark" ? 0.5 : 0)
  // Design margins: the trim's comfortable defaults, with a gutter that
  // grows with the book (minimum plus a little breathing room).
  const outside = Math.max(trim.marginIn.horizontal, minOuter)
  const inside = Math.max(trim.marginIn.horizontal, minGutter + 0.125)
  const top = Math.max(trim.marginIn.top, minOuter)
  const bottom = Math.max(trim.marginIn.bottom, minOuter)

  const b = opts.bleed ? BLEED_IN : 0
  const P = POINTS_PER_INCH
  const pageWidth = (trim.widthIn + b) * P
  const pageHeight = (trim.heightIn + 2 * b) * P
  const horizontal = ((b + inside + outside) / 2) * P
  return {
    pageWidth,
    pageHeight,
    margins: { inside, outside, top, bottom },
    padding: { top: (b + top) * P, bottom: (b + bottom) * P, horizontal },
    // Recto: text should start `inside` from the spine (left) edge.
    // Verso: the bleed is on the left, then the outside margin.
    shift: { recto: ((inside - outside - b) / 2) * P, verso: ((b + outside - inside) / 2) * P },
    textWidth: (trim.widthIn - inside - outside) * P,
    bleed: opts.bleed,
    trim: { widthIn: trim.widthIn, heightIn: trim.heightIn },
  }
}

/** Paper thickness per page, in inches (KDP; IngramSpark's 50lb stock is equivalent). */
const PAGE_THICKNESS_IN: Record<Paper, number> = { white: 0.002252, cream: 0.0025 }

export function spineWidthIn(pageCount: number, paper: Paper): number {
  return pageCount * PAGE_THICKNESS_IN[paper]
}

/** KDP allows text on the spine only above 79 pages; below that it would wrap onto the covers. */
export const MIN_PAGES_FOR_SPINE_TEXT = 80

export type CoverSize = {
  /** Full wraparound cover, in inches, including bleed on every edge. */
  widthIn: number
  heightIn: number
  spineIn: number
  bleedIn: number
  trim: { widthIn: number; heightIn: number }
  spineText: boolean
}

/** The size of the one-piece cover (back + spine + front) for a paperback. */
export function coverSize(opts: { trimSizeId: string; pageCount: number; paper: Paper }): CoverSize {
  const trim = getTrimSize(opts.trimSizeId)
  const spineIn = spineWidthIn(opts.pageCount, opts.paper)
  return {
    widthIn: BLEED_IN + trim.widthIn + spineIn + trim.widthIn + BLEED_IN,
    heightIn: BLEED_IN + trim.heightIn + BLEED_IN,
    spineIn,
    bleedIn: BLEED_IN,
    trim: { widthIn: trim.widthIn, heightIn: trim.heightIn },
    spineText: opts.pageCount >= MIN_PAGES_FOR_SPINE_TEXT,
  }
}

/** Readable inches, e.g. 6.125 → "6.125 in". */
export function formatInches(n: number): string {
  return `${Number(n.toFixed(3))} in`
}
