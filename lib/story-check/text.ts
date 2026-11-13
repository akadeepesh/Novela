/**
 * The manuscript as Story Check sees it: chapters → blocks (one per
 * paragraph or heading, in the same order ProseMirror walks them, so a
 * block index can be found again in the editor) → sentences.
 */

type DocNode = {
  type?: string
  text?: string
  attrs?: Record<string, unknown>
  content?: DocNode[]
}

export type MentionRef = { id: string; entityType: string; start: number; end: number }

export type Block = {
  /** Position among the document's textblocks, in document order. */
  index: number
  text: string
  /** @mention nodes, with where their label sits in `text`. */
  mentions: MentionRef[]
  /** [start, end) ranges of `text` inside quotation marks (dialogue). */
  quotes: [number, number][]
}

export type Sentence = { blockIndex: number; text: string; start: number; end: number; block: Block }

const INLINE = new Set(["text", "mention", "hardBreak", "image"])
const TEXTBLOCKS = new Set(["paragraph", "heading", "codeBlock"])

function isTextblock(node: DocNode): boolean {
  if (node.type && TEXTBLOCKS.has(node.type)) return true
  return Boolean(node.content?.length && node.content.every((c) => c.type && INLINE.has(c.type)))
}

/** [start, end) ranges inside “curly” or "straight" double quotes. */
export function quoteRanges(text: string): [number, number][] {
  const ranges: [number, number][] = []
  let open = -1
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === "“") open = i
    else if (ch === "”" && open >= 0) {
      ranges.push([open, i + 1])
      open = -1
    } else if (ch === '"') {
      if (open >= 0) {
        ranges.push([open, i + 1])
        open = -1
      } else open = i
    }
  }
  // An unclosed quote runs to the end of the paragraph (common in long speeches).
  if (open >= 0) ranges.push([open, text.length])
  return ranges
}

export function insideQuotes(block: Block, start: number, end = start + 1): boolean {
  return block.quotes.some(([a, b]) => start >= a && end <= b)
}

export function extractBlocks(content: unknown): Block[] {
  const blocks: Block[] = []
  const walk = (node: DocNode) => {
    if (!node || typeof node !== "object") return
    if (isTextblock(node)) {
      let text = ""
      const mentions: MentionRef[] = []
      for (const child of node.content ?? []) {
        if (child.type === "text") text += child.text ?? ""
        else if (child.type === "mention") {
          const label = typeof child.attrs?.label === "string" ? child.attrs.label : ""
          const id = typeof child.attrs?.id === "string" ? child.attrs.id : ""
          const entityType = typeof child.attrs?.entityType === "string" ? child.attrs.entityType : ""
          if (id) mentions.push({ id, entityType, start: text.length, end: text.length + label.length })
          text += label
        } else if (child.type === "hardBreak") text += "\n"
        else text += " "
      }
      blocks.push({ index: blocks.length, text, mentions, quotes: quoteRanges(text) })
      return
    }
    for (const child of node.content ?? []) walk(child)
  }
  walk(content as DocNode)
  return blocks
}

/** Splits a block into sentences, keeping offsets into the block text. */
export function splitSentences(block: Block): Sentence[] {
  const out: Sentence[] = []
  // A sentence ends at . ! ? or …, plus any closing quotes/brackets, before whitespace.
  const re = /[^.!?…]*(?:[.!?…]+["”’)\]]*|$)/g
  for (const m of block.text.matchAll(re)) {
    if (!m[0].trim()) continue
    const lead = m[0].length - m[0].trimStart().length
    const start = m.index! + lead
    const text = m[0].trim()
    out.push({ blockIndex: block.index, text, start, end: start + text.length, block })
  }
  return out
}

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/** A whole-word, case-sensitive matcher for any of `names` (longest first). */
export function namePattern(names: string[], flags = "gu"): RegExp | null {
  const clean = [...new Set(names.map((n) => n.trim()).filter((n) => n.length >= 2))].sort((a, b) => b.length - a.length)
  if (clean.length === 0) return null
  return new RegExp(`(?<![\\p{L}\\p{N}_])(?:${clean.map(escapeRegExp).join("|")})(?![\\p{L}\\p{N}_])`, flags)
}

export type NamedEntity = { id: string; names: string[]; kind: string }

export type Hit = { entityId: string; start: number; end: number; viaMention: boolean }

/**
 * Where entities are mentioned inside [from, to) of a block: @mentions by
 * id, plus their names and aliases written as plain text.
 */
export function findHits(block: Block, entities: { id: string; pattern: RegExp | null }[], from = 0, to = block.text.length): Hit[] {
  const hits: Hit[] = []
  const mentioned = new Set<string>()
  for (const m of block.mentions) {
    if (m.start >= from && m.end <= to && entities.some((e) => e.id === m.id)) {
      hits.push({ entityId: m.id, start: m.start, end: m.end, viaMention: true })
      mentioned.add(`${m.start}`)
    }
  }
  const slice = block.text.slice(from, to)
  for (const e of entities) {
    if (!e.pattern) continue
    e.pattern.lastIndex = 0
    for (const m of slice.matchAll(e.pattern)) {
      const start = from + m.index!
      // A plain-text hit on top of an @mention label is the same mention.
      if (block.mentions.some((x) => start >= x.start && start < x.end)) continue
      hits.push({ entityId: e.id, start, end: start + m[0].length, viaMention: false })
    }
  }
  return hits.sort((a, b) => a.start - b.start)
}

/**
 * The names an entity can be called by: its name, aliases, and the first
 * word of a multi-word name (people write "Mara" for "Mara Vale") when no
 * other entity uses that word.
 */
export function entityNames(all: { id: string; name: string; aliases: string[] }[]): Map<string, string[]> {
  const firstWordUsers = new Map<string, number>()
  for (const e of all) {
    const words = e.name.trim().split(/\s+/)
    if (words.length > 1 && words[0].length >= 3) firstWordUsers.set(words[0], (firstWordUsers.get(words[0]) ?? 0) + 1)
  }
  const out = new Map<string, string[]>()
  for (const e of all) {
    const names = [e.name, ...e.aliases]
    const words = e.name.trim().split(/\s+/)
    if (words.length > 1 && firstWordUsers.get(words[0]) === 1 && /^\p{Lu}/u.test(words[0])) names.push(words[0])
    out.set(e.id, names.filter((n) => n.trim()))
  }
  return out
}
