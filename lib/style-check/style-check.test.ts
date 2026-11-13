import { describe, expect, it } from "vitest"
import { extractBlocks } from "@/lib/story-check/text"
import { analyzeStyle, chapterStats } from "./rules"
import { DEFAULT_STYLE_SETTINGS, type StyleRuleId, type StyleSettings } from "./types"

function blocks(...paragraphs: string[]) {
  return extractBlocks({
    type: "doc",
    content: paragraphs.map((p) => ({ type: "paragraph", content: p ? [{ type: "text", text: p }] : [] })),
  })
}

function only(rule: StyleRuleId, over: Partial<StyleSettings> = {}): StyleSettings {
  const rules = { repeat: false, filler: false, "long-sentence": false, adverb: false, passive: false, [rule]: true }
  return { ...DEFAULT_STYLE_SETTINGS, ...over, rules }
}

const quotes = (paragraphs: string[], settings: StyleSettings, names?: string[]) =>
  analyzeStyle(blocks(...paragraphs), { settings, names }).map((f) => f.quote)

describe("repeated words", () => {
  it("flags a word used again within the window", () => {
    const found = analyzeStyle(blocks("She looked at the door. He looked away."), { settings: only("repeat") })
    expect(found).toHaveLength(1)
    expect(found[0].quote).toBe("looked")
    expect(found[0].message).toContain("4 words")
  })

  it("ignores repeats further apart than the window", () => {
    expect(quotes(["She looked at the door. He looked away."], only("repeat", { repeatWindow: 3 }))).toEqual([])
  })

  it("counts across paragraphs", () => {
    expect(quotes(["The lantern swung.", "The lantern died."], only("repeat"))).toEqual(["lantern"])
  })

  it("skips small words, speech tags and names", () => {
    expect(quotes(["Mara said that Mara said that it was said."], only("repeat"), ["Mara Vale"])).toEqual([])
  })

  it("matches regardless of case", () => {
    expect(quotes(["Silence fell. silence again."], only("repeat"))).toEqual(["silence"])
  })
})

describe("filler words", () => {
  it("flags list words and phrases outside dialogue", () => {
    expect(quotes(["She just started  to run, really fast."], only("filler"))).toEqual(["just", "started  to", "really"])
  })

  it("skips dialogue", () => {
    expect(quotes(["“I just can’t,” she said."], only("filler"))).toEqual([])
  })

  it("uses the writer's own list", () => {
    expect(quotes(["It was somewhat odd, really."], only("filler", { fillerWords: ["somewhat"] }))).toEqual(["somewhat"])
  })

  it("matches whole words only", () => {
    expect(quotes(["The justice of it was very clear."], only("filler", { fillerWords: ["just"] }))).toEqual([])
  })
})

describe("long sentences", () => {
  it("flags sentences over the limit", () => {
    const long = Array.from({ length: 12 }, (_, i) => `word${"abcdefghijkl"[i]}`).join(" ") + "."
    const found = analyzeStyle(blocks(`Short one. ${long} Another short one.`), { settings: only("long-sentence", { maxSentenceWords: 10 }) })
    expect(found).toHaveLength(1)
    expect(found[0].message).toBe("12 words. Your limit is 10.")
    expect(found[0].quote).toBe(long)
  })
})

describe("adverbs", () => {
  it("flags -ly adverbs but not look-alikes", () => {
    expect(quotes(["She walked slowly to the early train, an ugly, lonely thing."], only("adverb"))).toEqual(["slowly"])
  })

  it("skips capitalised names mid-sentence but not a sentence opener", () => {
    expect(quotes(["Quickly, she called Kelly."], only("adverb"))).toEqual(["Quickly"])
  })

  it("skips dialogue", () => {
    expect(quotes(["“Honestly,” she said."], only("adverb"))).toEqual([])
  })
})

describe("passive voice", () => {
  it("flags be + participle, regular and irregular", () => {
    expect(quotes(["The door was opened. The letters were stolen by Tom."], only("passive"))).toEqual(["was opened", "were stolen"])
  })

  it("allows an adverb in between", () => {
    expect(quotes(["The gate was quickly closed."], only("passive"))).toEqual(["was quickly closed"])
  })

  it("leaves states and plain adjectives alone", () => {
    expect(quotes(["She was tired. He was red. They were indeed late. It was cold."], only("passive"))).toEqual([])
  })

  it("skips dialogue", () => {
    expect(quotes(["“It was stolen,” he said."], only("passive"))).toEqual([])
  })
})

describe("settings", () => {
  it("drops ignored findings by key, and only those", () => {
    const settings = only("filler")
    const first = analyzeStyle(blocks("He just left. She just stayed."), { settings })
    expect(first).toHaveLength(2)
    const again = analyzeStyle(blocks("He just left. She just stayed."), { settings: { ...settings, ignored: [first[0].key] } })
    expect(again.map((f) => f.key)).toEqual([first[1].key])
  })

  it("keeps a key stable when other paragraphs change", () => {
    const a = analyzeStyle(blocks("Intro.", "He just left."), { settings: only("filler") })[0].key
    const b = analyzeStyle(blocks("A different intro entirely.", "More.", "He just left."), { settings: only("filler") })[0].key
    expect(a).toBe(b)
  })

  it("runs nothing when every rule is off", () => {
    const rules = { repeat: false, filler: false, "long-sentence": false, adverb: false, passive: false }
    expect(analyzeStyle(blocks("He just quickly looked, looked. It was taken."), { settings: { ...DEFAULT_STYLE_SETTINGS, rules } })).toEqual([])
  })

  it("is fast enough for a long chapter", () => {
    const para = "She walked slowly to the door, and the door was opened by someone she just didn’t know. “Who are you?” she asked."
    const long = blocks(...Array.from({ length: 400 }, () => para))
    const t = performance.now()
    analyzeStyle(long, { settings: DEFAULT_STYLE_SETTINGS })
    chapterStats(long, [{ id: "m", name: "Mara", aliases: [] }])
    expect(performance.now() - t).toBeLessThan(500)
  })
})

describe("chapter stats", () => {
  const MARA = { id: "mara", name: "Mara Vale", aliases: [] }
  const TOM = { id: "tom", name: "Tom", aliases: ["Captain"] }

  it("counts words, sentences and reading time", () => {
    const s = chapterStats(blocks("One two three. Four five.", "Six."))
    expect(s.words).toBe(6)
    expect(s.sentences).toBe(3)
    expect(s.avgSentenceWords).toBe(2)
    expect(s.longestSentenceWords).toBe(3)
    expect(s.readingMinutes).toBe(1)
  })

  it("measures dialogue against narration", () => {
    const s = chapterStats(blocks("“Go home now,” she said."))
    expect(s.dialogueWords).toBe(3)
    expect(s.dialogueShare).toBeCloseTo(3 / 5)
  })

  it("credits dialogue from tags after and beats before", () => {
    const s = chapterStats(
      blocks(
        "“Hold the line,” said Tom.",
        "Mara shook her head. “No.”",
        "“We go now,” Mara said. “Before the tide turns.”",
        "“Someone help!”"
      ),
      [MARA, TOM]
    )
    expect(s.speakers).toEqual([
      { id: "mara", name: "Mara Vale", words: 1 + 3 + 4 },
      { id: "tom", name: "Tom", words: 3 },
    ])
    expect(s.unattributedWords).toBe(2)
  })

  it("uses aliases and the only character named in the paragraph", () => {
    const s = chapterStats(blocks("The Captain frowned at the sea for a long while. “Storm coming.”"), [MARA, TOM])
    expect(s.speakers).toEqual([{ id: "tom", name: "Tom", words: 2 }])
  })

  it("reports adverbs per hundred narration words", () => {
    const s = chapterStats(blocks("He ran quickly and then stopped suddenly near the old gate today."))
    expect(s.adverbsPer100).toBeCloseTo(16.7)
  })
})
