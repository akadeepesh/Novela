import type { ExportBlock } from "@/lib/export/document-model"
import { blockToHtml, countWords, splitParagraphAtWord } from "./blocks-html"

/**
 * Splits a chapter's blocks into pages that actually fit a given page box,
 * by rendering into a hidden, identically-styled DOM element and measuring
 * real scrollHeight — the only reliable way to know where a page breaks
 * once real fonts, line-wrapping, and the reader's chosen font size are in
 * play. A word-heavy paragraph is split mid-sentence at a word boundary
 * (like an actual printed book) rather than being pushed whole onto the
 * next page and leaving the current one half-empty.
 *
 * `measureEl` must already have the exact width, font-size, line-height,
 * and typography classes the real page will render with — see
 * read-view.tsx, which builds one off-screen and reuses it across calls.
 */
export type PaginateOptions = {
  /**
   * Keep each paragraph whole rather than letting it flow across a page
   * break — right for poetry, where a paragraph is a stanza and splitting
   * one mid-way would misread the poem. A stanza taller than a full page
   * still gets split, since there's no alternative.
   */
  keepBlocksTogether?: boolean
}

// Never leave (or carry over) fewer than this many words at a page
// break — avoids a lone word stranded at the foot of a page or the top of
// the next one.
const MIN_WORDS_AT_BREAK = 4

export function paginateBlocks(
  blocks: ExportBlock[],
  measureEl: HTMLElement,
  pageHeightPx: number,
  options: PaginateOptions = {}
): ExportBlock[][] {
  if (blocks.length === 0) return [[]]

  const pages: ExportBlock[][] = []
  let currentPage: ExportBlock[] = []
  let currentHtml = ""

  // A mutable work queue rather than a for-of, since a too-tall block gets
  // split and its remainder pushed back on to be reprocessed as the start
  // of the next page.
  const queue = [...blocks]

  function measure(html: string): number {
    measureEl.innerHTML = html
    return measureEl.scrollHeight
  }

  function finalizePage() {
    pages.push(currentPage)
    currentPage = []
    currentHtml = ""
  }

  // Binary search for the most words of `block` that fit in the
  // *remaining* space on the current page (currentHtml already fits).
  function maxWordsThatFit(block: ExportBlock): number {
    const total = countWords(block)
    let lo = 0
    let hi = total
    let best = 0
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2)
      const { fit } = splitParagraphAtWord(block, mid)
      const html = currentHtml + blockToHtml(fit)
      if (measure(html) <= pageHeightPx) {
        best = mid
        lo = mid + 1
      } else {
        hi = mid - 1
      }
    }
    return best
  }

  let guard = 0
  const GUARD_LIMIT = blocks.length * 50 + 200 // generous — real content never gets close

  while (queue.length > 0) {
    guard++
    if (guard > GUARD_LIMIT) {
      // Pathological input (e.g. a page too small to hold even one word).
      // Dump whatever's left onto one final page rather than looping
      // forever — better a visibly overflowing page than a frozen tab.
      currentPage.push(...queue)
      queue.length = 0
      break
    }

    const block = queue[0]
    const candidateHtml = currentHtml + blockToHtml(block)

    if (measure(candidateHtml) <= pageHeightPx) {
      currentPage.push(block)
      currentHtml = candidateHtml
      queue.shift()
      continue
    }

    // Doesn't fit as-is.
    if (currentPage.length > 0) {
      // Let a prose paragraph flow across the break so the page fills up
      // like a printed book, instead of leaving the bottom empty and
      // pushing the whole paragraph over.
      if (block.kind === "paragraph" && !options.keepBlocksTogether) {
        const total = countWords(block)
        const words = maxWordsThatFit(block)
        if (words >= MIN_WORDS_AT_BREAK && total - words >= MIN_WORDS_AT_BREAK) {
          const { fit, rest } = splitParagraphAtWord(block, words)
          currentPage.push(fit)
          queue.shift()
          if (rest) queue.unshift(rest)
          finalizePage()
          continue
        }
      }
      // Otherwise close the page out and retry this same block against a
      // fresh, empty page.
      finalizePage()
      continue
    }

    // Doesn't fit on a completely empty page either.
    if (block.kind === "paragraph") {
      const words = maxWordsThatFit(block)
      if (words > 0) {
        const { fit, rest } = splitParagraphAtWord(block, words)
        currentPage.push(fit)
        currentHtml = currentHtml + blockToHtml(fit)
        queue.shift()
        if (rest) queue.unshift(rest)
        finalizePage()
        continue
      }
      // Not even one word fits (an absurdly narrow/short page) — accept
      // the overflow rather than spin forever.
      currentPage.push(block)
      queue.shift()
      finalizePage()
      continue
    }

    // A heading/blockquote taller than a full empty page — vanishingly
    // rare in practice. Accept the overflow rather than trying to split
    // formatting that isn't meant to break mid-line.
    currentPage.push(block)
    queue.shift()
    finalizePage()
  }

  if (currentPage.length > 0 || pages.length === 0) finalizePage()
  measureEl.innerHTML = ""
  return pages
}
