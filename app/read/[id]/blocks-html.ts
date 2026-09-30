import type { ExportBlock, ExportRun } from "@/lib/export/document-model"

/**
 * Renders ExportBlocks (the same intermediate representation Export uses)
 * to a plain HTML string. Used for BOTH the real page display and the
 * hidden pagination measurer (paginate.ts) — same HTML, same CSS classes
 * applied around it, so a page's measured height is always exactly what
 * gets displayed. Two separate rendering paths here would drift out of
 * sync the moment either one changed.
 */

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

function runsToHtml(runs: ExportRun[]): string {
  return runs
    .map((run) => {
      if ("break" in run) return "<br/>"
      let html = escapeHtml(run.text)
      if (run.marks.includes("bold")) html = `<strong>${html}</strong>`
      if (run.marks.includes("italic")) html = `<em>${html}</em>`
      return html
    })
    .join("")
}

export function blockToHtml(block: ExportBlock): string {
  const inner = runsToHtml(block.runs)
  if (block.kind === "heading") {
    const tag = `h${block.level}`
    return `<${tag}>${inner}</${tag}>`
  }
  if (block.kind === "blockquote") {
    return `<blockquote>${inner}</blockquote>`
  }
  return `<p>${inner}</p>`
}

export function blocksToHtml(blocks: ExportBlock[]): string {
  return blocks.map(blockToHtml).join("")
}

/** Plain-text word count of a paragraph block's runs (ignores marks/breaks). */
export function countWords(block: ExportBlock): number {
  if (block.kind !== "paragraph") return 0
  let total = 0
  for (const run of block.runs) {
    if ("break" in run) continue
    total += (run.text.match(/\S+/g) ?? []).length
  }
  return total
}

/**
 * Splits a paragraph block after `wordCount` words, preserving bold/italic
 * marks across the cut. Returns the leading `fit` portion and, if there's
 * anything left, a `rest` paragraph block to continue on the next page.
 * Non-paragraph blocks (headings, blockquotes) can't be split this way —
 * callers should only reach for this on `kind: "paragraph"`.
 */
export function splitParagraphAtWord(
  block: ExportBlock,
  wordCount: number
): { fit: ExportBlock; rest: ExportBlock | null } {
  if (block.kind !== "paragraph" || wordCount <= 0) {
    return { fit: { kind: "paragraph", runs: [] }, rest: block }
  }

  let remaining = wordCount
  const fitRuns: ExportRun[] = []
  const restRuns: ExportRun[] = []
  let splitting = false

  for (const run of block.runs) {
    if (splitting) {
      restRuns.push(run)
      continue
    }
    if ("break" in run) {
      fitRuns.push(run)
      continue
    }
    // Split on whitespace while keeping the whitespace tokens themselves,
    // so rejoining fit/rest segments never loses or doubles a space.
    const tokens = run.text.split(/(\s+)/)
    let wordsSeen = 0
    let cutAt = tokens.length
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].trim() === "") continue
      wordsSeen++
      if (wordsSeen > remaining) {
        cutAt = i
        break
      }
    }
    if (cutAt >= tokens.length) {
      fitRuns.push(run)
      remaining -= wordsSeen
    } else {
      const fitText = tokens.slice(0, cutAt).join("")
      const restText = tokens.slice(cutAt).join("")
      if (fitText) fitRuns.push({ text: fitText, marks: run.marks })
      if (restText) restRuns.push({ text: restText, marks: run.marks })
      splitting = true
    }
  }

  return {
    fit: { kind: "paragraph", runs: fitRuns },
    rest: restRuns.length > 0 ? { kind: "paragraph", runs: restRuns } : null,
  }
}
