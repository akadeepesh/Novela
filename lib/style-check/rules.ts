import { countWordsInText } from "@/lib/word-count"
import { entityNames, escapeRegExp, findHits, insideQuotes, namePattern, splitSentences, type Block, type Sentence } from "@/lib/story-check/text"
import { STYLE_RULE_IDS, type ChapterStats, type StyleCharacter, type StyleFinding, type StyleRuleId, type StyleSettings } from "./types"
import { ADVERB_SKIP, BE_FORMS, IRREGULAR_PARTICIPLES, REPEAT_SKIP, STATE_ADJECTIVES } from "./words"

/** A word: letters, with apostrophes inside ("don't", "Mara’s"). */
const WORD = /\p{L}+(?:['’]\p{L}+)*/gu

/** "-ed" words that aren't past participles. */
const NOT_PARTICIPLE = new Set(["need", "seed", "speed", "breed", "feed", "greed", "weed", "indeed", "embed", "hundred", "kindred", "sacred", "naked", "wicked"])

const PASSIVE = new RegExp(`(?<![\\p{L}'’])(${BE_FORMS.join("|")})\\s+(?:(\\p{L}+ly)\\s+)?(\\p{L}+)(?![\\p{L}'’])`, "giu")

type Token = { word: string; lower: string; start: number; end: number }

function tokens(text: string): Token[] {
  const out: Token[] = []
  for (const m of text.matchAll(WORD)) {
    out.push({ word: m[0], lower: m[0].toLowerCase().replace(/’/g, "'"), start: m.index!, end: m.index! + m[0].length })
  }
  return out
}

/** A short, stable hash for finding keys. */
function hash(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(36)
}

function sentenceAt(sentences: Sentence[], offset: number): Sentence | undefined {
  return sentences.find((s) => offset >= s.start && offset < s.end) ?? sentences[sentences.length - 1]
}

/** The key ties a finding to its rule, its words and the sentence around it. */
function keyFor(rule: StyleRuleId, quote: string, sentence: Sentence | undefined): string {
  const context = (sentence?.text ?? "").toLowerCase().replace(/\s+/g, " ")
  return `${rule}:${quote.toLowerCase()}:${hash(context)}`
}

/** Is the word at `start` the first word of its sentence (where capitals are normal)? */
function startsSentence(text: string, start: number): boolean {
  const before = text.slice(0, start).replace(/[\s"“‘'(\[—-]+$/u, "")
  return before === "" || /[.!?…:]$/.test(before)
}

function isAdverb(t: Token, text: string): boolean {
  if (t.lower.length < 5 || !t.lower.endsWith("ly") || ADVERB_SKIP.has(t.lower)) return false
  // A capitalised "-ly" word mid-sentence is a name (Kelly, Bexley).
  if (/^\p{Lu}/u.test(t.word) && !startsSentence(text, t.start)) return false
  return true
}

function isParticiple(word: string): boolean {
  const w = word.toLowerCase()
  if (IRREGULAR_PARTICIPLES.has(w)) return true
  return w.length >= 5 && w.endsWith("ed") && !NOT_PARTICIPLE.has(w) && !STATE_ADJECTIVES.has(w)
}

/** One regex for the filler list; spaces in a phrase match any run of whitespace. */
function fillerPattern(words: string[]): RegExp | null {
  const clean = [...new Set(words.map((w) => w.trim().toLowerCase()).filter(Boolean))].sort((a, b) => b.length - a.length)
  if (clean.length === 0) return null
  const alts = clean.map((w) => escapeRegExp(w).replace(/\s+/g, "\\s+"))
  return new RegExp(`(?<![\\p{L}\\p{N}_'’])(?:${alts.join("|")})(?![\\p{L}\\p{N}_'’])`, "giu")
}

export type StyleOptions = {
  settings: StyleSettings
  /** Names (and aliases) of characters and places; never flagged as repeats. */
  names?: string[]
}

/**
 * Every style finding in a chapter, in reading order. Switched-off checks
 * and dismissed findings are left out.
 */
export function analyzeStyle(blocks: Block[], { settings, names = [] }: StyleOptions): StyleFinding[] {
  const on = (r: StyleRuleId) => settings.rules[r] !== false
  const ignored = new Set(settings.ignored)
  const nameWords = new Set(names.flatMap((n) => n.toLowerCase().split(/\s+/)).filter(Boolean))
  const filler = on("filler") ? fillerPattern(settings.fillerWords) : null
  const window = Math.max(2, settings.repeatWindow)
  const maxWords = Math.max(5, settings.maxSentenceWords)
  const out: StyleFinding[] = []

  // Repeats run across paragraph breaks, so track words by their position
  // in the whole chapter.
  const lastSeen = new Map<string, number>()
  let wordIndex = 0

  for (const block of blocks) {
    const text = block.text
    if (!text.trim()) continue
    const sentences = splitSentences(block)
    const add = (rule: StyleRuleId, start: number, end: number, message: string) => {
      const quote = text.slice(start, end)
      const key = keyFor(rule, rule === "long-sentence" ? "" : quote, sentenceAt(sentences, start))
      if (!ignored.has(key)) out.push({ key, rule, blockIndex: block.index, start, end, quote, message })
    }

    const toks = tokens(text)

    if (on("repeat")) {
      for (const t of toks) {
        const i = wordIndex++
        if (t.lower.length < 4 || REPEAT_SKIP.has(t.lower) || nameWords.has(t.lower)) continue
        const prev = lastSeen.get(t.lower)
        lastSeen.set(t.lower, i)
        if (prev !== undefined && i - prev <= window) {
          const between = i - prev - 1
          add(
            "repeat",
            t.start,
            t.end,
            between === 0 ? `“${t.word}” twice in a row.` : `“${t.word}” again after only ${between} word${between === 1 ? "" : "s"}.`
          )
        }
      }
    } else {
      wordIndex += toks.length
    }

    if (filler) {
      filler.lastIndex = 0
      for (const m of text.matchAll(filler)) {
        const start = m.index!
        const end = start + m[0].length
        if (insideQuotes(block, start, end)) continue
        add("filler", start, end, `“${m[0]}” often adds little. Cut it, or find a stronger word.`)
      }
    }

    if (on("long-sentence")) {
      for (const s of sentences) {
        const n = countWordsInText(s.text)
        if (n > maxWords) add("long-sentence", s.start, s.end, `${n} words. Your limit is ${maxWords}.`)
      }
    }

    if (on("adverb")) {
      for (const t of toks) {
        if (!isAdverb(t, text) || insideQuotes(block, t.start, t.end)) continue
        add("adverb", t.start, t.end, `“${t.word}”: could a stronger verb do this job?`)
      }
    }

    if (on("passive")) {
      PASSIVE.lastIndex = 0
      for (const m of text.matchAll(PASSIVE)) {
        if (!isParticiple(m[3])) continue
        const start = m.index!
        const end = start + m[0].length
        if (insideQuotes(block, start, end)) continue
        add("passive", start, end, `“${m[0]}” is passive. Would it be clearer to say who did it?`)
      }
    }
  }

  const order = new Map(STYLE_RULE_IDS.map((r, i) => [r, i]))
  return out.sort((a, b) => a.blockIndex - b.blockIndex || a.start - b.start || order.get(a.rule)! - order.get(b.rule)!)
}

// ---------------------------------------------------------------------------
// Chapter stats
// ---------------------------------------------------------------------------

/** Text between `from` and `to` up to the end of its first sentence. */
function firstClause(text: string, from: number, to: number): [number, number] {
  const slice = text.slice(from, to)
  const m = /[.!?…]/.exec(slice)
  return [from, m ? from + m.index + 1 : to]
}

/** Text between `from` and `to` after the last sentence end. */
function lastClause(text: string, from: number, to: number): [number, number] {
  const slice = text.slice(from, to)
  let cut = -1
  for (const m of slice.matchAll(/[.!?…]/g)) if (m.index! < slice.trimEnd().length - 1) cut = m.index!
  return [cut >= 0 ? from + cut + 1 : from, to]
}

/**
 * Credits each piece of dialogue to a character: one named in the tag right
 * after it ("said Mara") or the beat right before it ("Mara turned."), then
 * the paragraph's earlier speaker, then the only character named in the
 * paragraph. Anything else is unattributed.
 */
function attributeDialogue(block: Block, entities: { id: string; pattern: RegExp | null }[]): { speaker: string | null; words: number }[] {
  const text = block.text
  const out: { speaker: string | null; words: number }[] = []
  const narrationHits = new Set<string>()
  let prevEnd = 0
  for (const [a, b] of [...block.quotes, [text.length, text.length] as [number, number]]) {
    for (const h of findHits(block, entities, prevEnd, a)) narrationHits.add(h.entityId)
    prevEnd = b
  }
  const onlyOne = narrationHits.size === 1 ? [...narrationHits][0] : null

  let last: string | null = null
  block.quotes.forEach(([a, b], i) => {
    const nextStart = block.quotes[i + 1]?.[0] ?? text.length
    const prevQuoteEnd = i > 0 ? block.quotes[i - 1][1] : 0
    const after = firstClause(text, b, nextStart)
    const before = lastClause(text, prevQuoteEnd, a)
    const afterHit = findHits(block, entities, after[0], after[1])[0]
    const beforeHits = findHits(block, entities, before[0], before[1])
    const speaker = afterHit?.entityId ?? beforeHits[beforeHits.length - 1]?.entityId ?? last ?? onlyOne
    last = speaker
    out.push({ speaker, words: countWordsInText(text.slice(a, b)) })
  })
  return out
}

export function chapterStats(blocks: Block[], characters: StyleCharacter[] = []): ChapterStats {
  const names = entityNames(characters)
  const entities = characters.map((c) => ({ id: c.id, pattern: namePattern(names.get(c.id) ?? []) }))
  const byId = new Map(characters.map((c) => [c.id, c.name]))
  const spoken = new Map<string, number>()
  let words = 0
  let sentences = 0
  let longest = 0
  let dialogueWords = 0
  let unattributed = 0
  let adverbs = 0
  let narrationWords = 0

  for (const block of blocks) {
    if (!block.text.trim()) continue
    words += countWordsInText(block.text)
    for (const s of splitSentences(block)) {
      const n = countWordsInText(s.text)
      if (n === 0) continue
      sentences++
      longest = Math.max(longest, n)
    }
    for (const t of tokens(block.text)) {
      if (insideQuotes(block, t.start, t.end)) continue
      narrationWords++
      if (isAdverb(t, block.text)) adverbs++
    }
    for (const q of attributeDialogue(block, entities)) {
      dialogueWords += q.words
      if (q.speaker) spoken.set(q.speaker, (spoken.get(q.speaker) ?? 0) + q.words)
      else unattributed += q.words
    }
  }

  return {
    words,
    sentences,
    avgSentenceWords: sentences ? Math.round((words / sentences) * 10) / 10 : 0,
    longestSentenceWords: longest,
    readingMinutes: words ? Math.max(1, Math.round(words / 250)) : 0,
    dialogueWords,
    dialogueShare: words ? Math.min(1, dialogueWords / words) : 0,
    adverbsPer100: narrationWords ? Math.round((adverbs / narrationWords) * 1000) / 10 : 0,
    speakers: [...spoken.entries()]
      .map(([id, w]) => ({ id, name: byId.get(id) ?? "Unknown", words: w }))
      .sort((a, b) => b.words - a.words),
    unattributedWords: unattributed,
  }
}
