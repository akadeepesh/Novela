import type { CheckCharacter, CheckThread, Issue, StoryCheckInput } from "./types"
import {
  entityNames,
  findHits,
  insideQuotes,
  namePattern,
  escapeRegExp,
  splitSentences,
  type Block,
  type Hit,
  type Sentence,
} from "./text"
import {
  ACTION_VERBS,
  AGE_WORD,
  COLOURS,
  MEMORY_CUES,
  NOT_ACTIONS,
  SPEECH_VERBS,
  colourFamilies,
  parseAge,
  type Feature,
} from "./vocab"

/** Everything the rules share, computed once per run. */
export type Prepared = {
  input: StoryCheckInput
  chapters: { id: string; title: string; index: number; flashback: boolean; year: number | null; blocks: Block[]; sentences: Sentence[] }[]
  characterPatterns: { id: string; pattern: RegExp | null }[]
  /** For each character, the chapter indexes they appear in. */
  appearances: Map<string, Set<number>>
}

function parseYear(date: string | undefined): number | null {
  const m = date?.trim().match(/^(-?\d{1,4})/)
  return m ? Number(m[1]) : null
}

export function prepare(input: StoryCheckInput, extract: (content: unknown) => Block[]): Prepared {
  const names = entityNames(input.characters)
  const characterPatterns = input.characters.map((c) => ({ id: c.id, pattern: namePattern(names.get(c.id) ?? []) }))
  const appearances = new Map<string, Set<number>>(input.characters.map((c) => [c.id, new Set()]))
  const chapters = input.chapters.map((ch, index) => {
    const blocks = extract(ch.content)
    for (const block of blocks) {
      for (const hit of findHits(block, characterPatterns)) appearances.get(hit.entityId)?.add(index)
    }
    return {
      id: ch.id,
      title: ch.title,
      index,
      flashback: Boolean(ch.flashback),
      year: parseYear(ch.storyDate),
      blocks,
      sentences: blocks.flatMap(splitSentences),
    }
  })
  return { input, chapters, characterPatterns, appearances }
}

function characterHitsIn(p: Prepared, s: Sentence): Hit[] {
  return findHits(s.block, p.characterPatterns, s.start, s.end)
}

const characterEntity = (c: CheckCharacter) => ({ id: c.id, name: c.name, kind: "character" as const })

// ---------------------------------------------------------------------------
// 1. Character facts: eye and hair colour
// ---------------------------------------------------------------------------

const OTHER_POSSESSIVE: Record<string, string[]> = { she: ["his", "their"], he: ["her", "their"], they: ["his", "her"] }

export function factConflicts(p: Prepared): Issue[] {
  const issues: Issue[] = []
  const features: Feature[] = ["eyes", "hair"]
  const profile = new Map(
    p.input.characters.map((c) => [c.id, { eyes: colourFamilies("eyes", c.eyeColor), hair: colourFamilies("hair", c.hairColor) }])
  )
  const byId = new Map(p.input.characters.map((c) => [c.id, c]))

  for (const ch of p.chapters) {
    for (const s of ch.sentences) {
      const hits = characterHitsIn(p, s)
      const people = new Set(hits.map((h) => h.entityId))
      // Only when exactly one known character is in the sentence: otherwise
      // whose eyes they are is a guess.
      if (people.size !== 1) continue
      const character = byId.get([...people][0])!
      for (const feature of features) {
        const expected = profile.get(character.id)![feature]
        if (expected.size === 0) continue
        const words = Object.keys(COLOURS[feature]).map(escapeRegExp).join("|")
        const noun = feature === "eyes" ? "eyes?" : "hair(?:ed)?"
        const res = [
          new RegExp(`(?<![\\p{L}-])(${words})(?:[ -][\\p{Ll}]+)?[ -]${noun}(?![\\p{L}])`, "giu"),
          new RegExp(`(?<![\\p{L}])${feature === "eyes" ? "eyes" : "hair"},? (?:were|was|are|is) (?:a |an )?(?:[\\p{Ll}]+ )?(${words})(?![\\p{L}-])`, "giu"),
        ]
        for (const re of res) {
          for (const m of s.text.matchAll(re)) {
            const at = s.start + m.index!
            if (insideQuotes(s.block, at, at + m[0].length)) continue
            const colour = m[1].toLowerCase()
            const family = COLOURS[feature][colour]
            if (!family || expected.has(family)) continue
            // "the stranger's blue eyes", or "his eyes" for a she: someone else's.
            const before = s.text.slice(Math.max(0, m.index! - 30), m.index!)
            const lastWords = before.split(/\s+/).slice(-3).join(" ")
            const possessive = lastWords.match(/([\p{L}]+)['’]s\b/u)
            if (possessive && !hits.some((h) => s.block.text.slice(h.start, h.end).startsWith(possessive[1]))) continue
            const others = character.pronouns ? OTHER_POSSESSIVE[character.pronouns] ?? [] : []
            if (others.some((w) => new RegExp(`\\b${w}\\b`, "i").test(lastWords))) continue

            const label = feature === "eyes" ? "eyes" : "hair"
            const profileValue = feature === "eyes" ? character.eyeColor : character.hairColor
            issues.push({
              key: `fact-conflict:${character.id}:${ch.id}:${feature}:${colour}`,
              rule: "fact-conflict",
              severity: "warning",
              message: `${character.name}'s ${label} are ${profileValue} in their profile, but “${m[0]}” here.`,
              entity: characterEntity(character),
              location: { chapterId: ch.id, chapterTitle: ch.title, blockIndex: s.blockIndex, quote: m[0] },
            })
          }
        }
      }
    }
  }
  return dedupe(issues)
}

// ---------------------------------------------------------------------------
// 2. A dead character speaks or acts
// ---------------------------------------------------------------------------

export function deadAppears(p: Prepared): Issue[] {
  const issues: Issue[] = []
  const chapterIndex = new Map(p.chapters.map((c) => [c.id, c.index]))
  const speech = SPEECH_VERBS.join("|")
  const action = ACTION_VERBS.join("|")
  const memory = new RegExp(`\\b(?:${MEMORY_CUES.map(escapeRegExp).join("|")})\\b`, "i")

  for (const character of p.input.characters) {
    if (character.status !== "dead" || !character.statusChapterId) continue
    const diedAt = chapterIndex.get(character.statusChapterId)
    if (diedAt === undefined) continue
    const died = p.chapters[diedAt]
    const pattern = p.characterPatterns.find((c) => c.id === character.id)!

    for (const ch of p.chapters) {
      if (ch.index <= diedAt || ch.flashback) continue
      for (const s of ch.sentences) {
        if (memory.test(s.text)) continue
        for (const hit of findHits(s.block, [pattern], s.start, s.end)) {
          if (insideQuotes(s.block, hit.start, hit.end)) continue // someone talking about them
          const after = s.block.text.slice(hit.end, s.end)
          const before = s.block.text.slice(s.start, hit.start)
          // "Mara said", "Mara, pale and shaking, walked", "Mara turned".
          const acts = after.match(new RegExp(`^(?:,[^,]{1,40},)?\\s+(?:${action}|[\\p{Ll}]{3,}ed)(?![\\p{L}])`, "iu"))
          const verb = acts?.[0].trim().split(/\s+/).pop()?.toLowerCase()
          const doing = acts && verb && !NOT_ACTIONS.has(verb) && !(verb === "was" && /^\s+was\s+(?:dead|gone|buried|killed|never)/i.test(after))
          // ”…,” said Mara
          const speaks = new RegExp(`(?:${speech})\\s*$`, "i").test(before) && /["”]/.test(before)
          if (!doing && !speaks) continue
          const quote = s.block.text.slice(speaks ? s.start + before.search(new RegExp(`(?:${speech})\\s*$`, "i")) : hit.start, speaks ? hit.end : hit.end + (acts?.[0].length ?? 0)).trim()
          issues.push({
            key: `dead-appears:${character.id}:${ch.id}:${quote}`,
            rule: "dead-appears",
            severity: "warning",
            message: `${character.name} died in “${died.title}”, but speaks or acts here. If this is a memory or a flashback, mark the chapter as a flashback.`,
            entity: characterEntity(character),
            location: { chapterId: ch.id, chapterTitle: ch.title, blockIndex: s.blockIndex, quote },
          })
          break
        }
      }
    }
  }
  return dedupe(issues)
}

// ---------------------------------------------------------------------------
// 3. Name spelling drift
// ---------------------------------------------------------------------------

/** Optimal string alignment distance (Levenshtein plus swapped neighbours), stopping early past `max`. */
export function editDistance(a: string, b: string, max = 3): number {
  if (Math.abs(a.length - b.length) > max) return max + 1
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 0; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    let rowMin = Infinity
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
      rowMin = Math.min(rowMin, d[i][j])
    }
    if (rowMin > max) return max + 1
  }
  return d[a.length][b.length]
}

const times = (n: number) => `${n} ${n === 1 ? "time" : "times"}`

export function nameDrift(p: Prepared): Issue[] {
  type Known = { word: string; entity: { id: string; name: string; kind: "character" | "place" } }
  const known: Known[] = []
  const charNames = entityNames(p.input.characters)
  for (const c of p.input.characters) {
    for (const n of charNames.get(c.id) ?? []) for (const w of n.split(/\s+/)) known.push({ word: w, entity: { id: c.id, name: c.name, kind: "character" } })
  }
  const placeNames = entityNames(p.input.places)
  for (const pl of p.input.places) {
    for (const n of placeNames.get(pl.id) ?? []) for (const w of n.split(/\s+/)) known.push({ word: w, entity: { id: pl.id, name: pl.name, kind: "place" } })
  }
  const knownWords = new Set(known.map((k) => k.word))
  const ignored = new Set(p.input.settings.ignoredNames.map((n) => n.toLowerCase()))

  // Count every word as written, and remember where each capitalised one first appears.
  const counts = new Map<string, number>()
  const lower = new Set<string>()
  const first = new Map<string, { chapter: Prepared["chapters"][number]; blockIndex: number }>()
  for (const ch of p.chapters) {
    for (const block of ch.blocks) {
      for (const m of block.text.matchAll(/[\p{L}]+(?:['’][\p{L}]+)?/gu)) {
        const word = m[0].replace(/['’]s$/u, "")
        counts.set(word, (counts.get(word) ?? 0) + 1)
        if (/^\p{Ll}/u.test(word)) lower.add(word.toLowerCase())
        if (/^\p{Lu}\p{Ll}/u.test(word) && !first.has(word)) first.set(word, { chapter: ch, blockIndex: block.index })
      }
    }
  }

  const issues: Issue[] = []
  for (const [word, where] of first) {
    if (word.length < 5 || knownWords.has(word) || ignored.has(word.toLowerCase())) continue
    // Ordinary words also appear lowercase somewhere; names don't.
    if (lower.has(word.toLowerCase())) continue
    const uses = counts.get(word) ?? 0
    if (uses > 3) continue
    let best: { k: Known; dist: number } | null = null
    for (const k of known) {
      if (k.word.length < 5 || k.word[0] !== word[0]) continue
      if (word === `${k.word}s` || word === `${k.word}es`) continue
      const limit = k.word.length >= 9 ? 2 : 1
      const dist = editDistance(word, k.word, limit)
      if (dist <= limit && (!best || dist < best.dist)) best = { k, dist }
    }
    if (!best) continue
    // A typo is rarer than the real name.
    if ((counts.get(best.k.word) ?? 0) <= uses) continue
    issues.push({
      key: `name-drift:${word}:${best.k.word}`,
      rule: "name-drift",
      severity: "warning",
      message: `“${word}” (${times(uses)}) looks like a misspelling of “${best.k.word}” (${times(counts.get(best.k.word) ?? 0)}). If it's a different name, ignore it.`,
      entity: { id: best.k.entity.id, name: best.k.entity.name, kind: best.k.entity.kind },
      location: { chapterId: where.chapter.id, chapterTitle: where.chapter.title, blockIndex: where.blockIndex, quote: word },
    })
  }
  return issues
}

// ---------------------------------------------------------------------------
// 4. Forgotten characters
// ---------------------------------------------------------------------------

export function forgotten(p: Prepared): Issue[] {
  const n = Math.max(1, p.input.settings.forgottenAfterChapters)
  const issues: Issue[] = []
  const last = p.chapters.length - 1
  for (const c of p.input.characters) {
    if (c.role === "minor" || c.status === "dead") continue
    const seen = p.appearances.get(c.id)
    if (!seen || seen.size === 0) continue // not written in yet
    const lastSeen = Math.max(...seen)
    const gap = last - lastSeen
    if (gap < n) continue
    const ch = p.chapters[lastSeen]
    issues.push({
      key: `forgotten:${c.id}`,
      rule: "forgotten",
      severity: "info",
      message: `${c.name} hasn't appeared in the last ${gap} chapters, since “${ch.title}”.`,
      entity: characterEntity(c),
      location: { chapterId: ch.id, chapterTitle: ch.title },
    })
  }
  return issues
}

// ---------------------------------------------------------------------------
// 5. Open plot threads
// ---------------------------------------------------------------------------

export function openThreads(p: Prepared): Issue[] {
  const issues: Issue[] = []
  const total = p.chapters.length
  const tail = Math.max(1, Math.ceil(total / 4))
  const threadEntity = (t: CheckThread) => ({ id: t.id, name: t.title, kind: "thread" as const })

  for (const t of p.input.threads) {
    if (t.status === "resolved" || t.status === "abandoned" || t.resolvedChapterId) continue
    const pattern = namePattern([t.title, ...t.aliases], "giu")
    const seenIn: number[] = []
    for (const ch of p.chapters) {
      const found = ch.blocks.some((b) => findHits(b, [{ id: t.id, pattern }]).length > 0)
      if (found) seenIn.push(ch.index)
    }
    const lastSeen = seenIn.length ? Math.max(...seenIn) : -1
    if (total >= 4 && lastSeen >= 0 && lastSeen < total - tail) {
      const ch = p.chapters[lastSeen]
      issues.push({
        key: `open-thread:faded:${t.id}`,
        rule: "open-thread",
        severity: "warning",
        message: `“${t.title}” is still open but hasn't come up in the last quarter of the book (last in “${ch.title}”).`,
        entity: threadEntity(t),
        location: { chapterId: ch.id, chapterTitle: ch.title },
      })
    } else {
      issues.push({
        key: `open-thread:open:${t.id}`,
        rule: "open-thread",
        severity: "info",
        message: `“${t.title}” has no resolution yet. When it's resolved, set the chapter on the plot thread.`,
        entity: threadEntity(t),
      })
    }
  }
  return issues
}

// ---------------------------------------------------------------------------
// 6. Ages vs birth year and chapter date
// ---------------------------------------------------------------------------

const UNITS = /^\s*(?:feet|foot|ft|inches|inch|minutes?|hours?|days?|weeks?|months?|miles?|metres?|meters?|percent|%|o['’]clock|times|pounds?|kilos?|steps?|paces?|people|men|women)\b/i

export function timeline(p: Prepared): Issue[] {
  const issues: Issue[] = []
  for (const c of p.input.characters) {
    if (!c.birthYear) continue
    const names = entityNames(p.input.characters).get(c.id) ?? []
    const name = names.map(escapeRegExp).sort((a, b) => b.length - a.length).join("|")
    if (!name) continue
    const res = [
      new RegExp(`(?<![\\p{L}])(?:${name}),\\s+(${AGE_WORD}),`, "giu"),
      new RegExp(`(?<![\\p{L}])(?:${name})(?:,)?\\s+(?:was|is|turned|had turned|has turned)\\s+(?:just\\s+|only\\s+|nearly\\s+|almost\\s+)?(${AGE_WORD})(?=(\\s+years?\\s+old)?[\\s,.;!?]|$)`, "giu"),
      new RegExp(`(?<![\\p{L}])(${AGE_WORD})-year-old\\s+(?:${name})(?![\\p{L}])`, "giu"),
    ]
    for (const ch of p.chapters) {
      if (ch.year === null || ch.flashback) continue
      const expected = ch.year - c.birthYear
      for (const s of ch.sentences) {
        for (const re of res) {
          for (const m of s.text.matchAll(re)) {
            const after = s.text.slice(m.index! + m[0].length)
            if (UNITS.test(after)) continue
            const isAbout = /(?:nearly|almost)\s/i.test(m[0])
            const age = parseAge(m[1])
            if (age === null) continue
            // Birthdays aren't known, so a year either way is fine.
            const off = isAbout ? age - expected > 1 || expected - age > 1 : Math.abs(age - expected) > 1
            if (!off) continue
            issues.push({
              key: `timeline:${c.id}:${ch.id}:${age}`,
              rule: "timeline",
              severity: "warning",
              message: `${c.name} is ${age} here, but born in ${c.birthYear} they'd be about ${expected} in ${ch.year}.`,
              entity: characterEntity(c),
              location: { chapterId: ch.id, chapterTitle: ch.title, blockIndex: s.blockIndex, quote: m[0].replace(/,$/, "") },
            })
          }
        }
      }
    }
  }
  return dedupe(issues)
}

function dedupe(issues: Issue[]): Issue[] {
  const seen = new Set<string>()
  return issues.filter((i) => (seen.has(i.key) ? false : (seen.add(i.key), true)))
}
