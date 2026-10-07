/**
 * Word count for a Tiptap/ProseMirror document, shared by the server (which
 * is the source of truth for the stored count) and the editor footer (so the
 * number you see matches the number that is saved).
 *
 * Uses Intl.Segmenter, so scripts written without spaces (Chinese, Japanese,
 * Thai) and Indic scripts are counted as words rather than as one giant
 * "word" per line. Falls back to whitespace splitting if Segmenter is missing.
 */

type DocNode = {
  type?: string
  text?: string
  attrs?: { label?: unknown }
  content?: DocNode[]
}

const INLINE_TYPES = new Set(["text", "mention"])

// Walks the document and returns its plain text, with a newline between
// blocks so the last word of one paragraph never fuses with the first of the next.
function collectText(node: DocNode, out: string[]): void {
  if (node.type === "text") {
    if (node.text) out.push(node.text)
    return
  }
  if (node.type === "mention") {
    if (typeof node.attrs?.label === "string") out.push(node.attrs.label)
    return
  }
  if (node.type === "hardBreak") {
    out.push("\n")
    return
  }
  for (const child of node.content ?? []) collectText(child, out)
  if (node.type && !INLINE_TYPES.has(node.type) && node.type !== "doc") out.push("\n")
}

let segmenter: Intl.Segmenter | null | undefined

function getSegmenter(): Intl.Segmenter | null {
  if (segmenter === undefined) {
    segmenter = typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter(undefined, { granularity: "word" }) : null
  }
  return segmenter
}

export function countWordsInText(text: string): number {
  if (!text.trim()) return 0
  const seg = getSegmenter()
  if (!seg) return text.trim().split(/\s+/).length
  let count = 0
  for (const part of seg.segment(text)) if (part.isWordLike) count++
  return count
}

export function countWords(doc: unknown): number {
  if (!doc || typeof doc !== "object") return 0
  const parts: string[] = []
  collectText(doc as DocNode, parts)
  return countWordsInText(parts.join(""))
}
