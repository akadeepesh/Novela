import { describe, expect, it } from "vitest"
import { runStoryCheck } from "./run"
import { editDistance } from "./rules"
import { extractBlocks, splitSentences } from "./text"
import { DEFAULT_STORY_CHECK_SETTINGS, type CheckChapter, type CheckCharacter, type StoryCheckInput } from "./types"

/** A chapter from plain paragraphs. "@Name" becomes a real @mention node. */
function chapter(id: string, order: number, paragraphs: string[], extra: Partial<CheckChapter> = {}): CheckChapter {
  return {
    id,
    title: `Chapter ${order + 1}`,
    order,
    ...extra,
    content: {
      type: "doc",
      content: paragraphs.map((p) => ({
        type: "paragraph",
        content: p.split(/(@\w+)/).filter(Boolean).map((part) =>
          part.startsWith("@")
            ? { type: "mention", attrs: { id: part.slice(1).toLowerCase(), entityType: "character", label: part.slice(1) } }
            : { type: "text", text: part }
        ),
      })),
    },
  }
}

const filler = (n: number) => Array.from({ length: n }, (_, i) => `The road went on for mile ${i}.`)

const MARA: CheckCharacter = {
  id: "mara", name: "Mara Vale", aliases: [], role: "protagonist",
  eyeColor: "green", hairColor: "black", birthYear: 1990, pronouns: "she",
}
const TOMAS: CheckCharacter = {
  id: "tomas", name: "Tomas", aliases: ["the Captain"], role: "supporting",
  status: "dead", statusChapterId: "c3", pronouns: "he",
}
const KATHERINE: CheckCharacter = { id: "kath", name: "Katherine", aliases: [], role: "minor" }

function input(chapters: CheckChapter[], over: Partial<StoryCheckInput> = {}): StoryCheckInput {
  return {
    chapters,
    characters: [MARA, TOMAS, KATHERINE],
    places: [{ id: "harrow", name: "Harrowgate", aliases: [] }],
    threads: [{ id: "heist", title: "the heist", aliases: [], status: "active" }],
    settings: DEFAULT_STORY_CHECK_SETTINGS,
    ...over,
  }
}

const rulesOf = (issues: ReturnType<typeof runStoryCheck>) => issues.map((i) => i.rule)

describe("text model", () => {
  it("splits sentences and finds dialogue", () => {
    const [block] = extractBlocks(chapter("x", 0, ["“Run,” she said. He ran! Then silence…"]).content)
    expect(splitSentences(block).map((s) => s.text)).toEqual(["“Run,” she said.", "He ran!", "Then silence…"])
    expect(block.quotes).toEqual([[0, 6]])
  })

  it("counts edit distance with swaps", () => {
    expect(editDistance("Kathrine", "Katherine")).toBe(1)
    expect(editDistance("Mraa", "Mara")).toBe(1)
    expect(editDistance("Harrowgate", "Harrowgate")).toBe(0)
  })
})

describe("character facts", () => {
  it("flags a conflicting eye colour on the right character", () => {
    const issues = runStoryCheck(input([chapter("c1", 0, ["Mara looked up, her blue eyes sharp."])]))
    const fact = issues.find((i) => i.rule === "fact-conflict")
    expect(fact?.entity?.id).toBe("mara")
    expect(fact?.location?.quote).toBe("blue eyes")
    expect(fact?.location?.blockIndex).toBe(0)
  })

  it("works through an @mention and for hair", () => {
    const issues = runStoryCheck(input([chapter("c1", 0, ["@Mara tied back her blonde hair."])]))
    expect(issues.find((i) => i.rule === "fact-conflict")?.message).toMatch(/hair/)
  })

  it("stays quiet when the colour matches, is someone else's, or is in dialogue", () => {
    const issues = runStoryCheck(
      input([
        chapter("c1", 0, [
          "Mara's green eyes narrowed.",
          "Mara stared into the stranger's blue eyes.",
          "Mara watched him; his brown eyes were tired.",
          "“You have such blue eyes,” Mara said.",
          "Mara and Tomas compared blue eyes.",
        ]),
      ])
    )
    expect(rulesOf(issues)).not.toContain("fact-conflict")
  })
})

describe("dead characters", () => {
  const book = (later: string[], extra: Partial<CheckChapter> = {}) => [
    chapter("c1", 0, ["Tomas said hello."]),
    chapter("c2", 1, ["Tomas laughed."]),
    chapter("c3", 2, ["Tomas fell from the tower."]),
    chapter("c4", 3, later, extra),
  ]

  it("flags a dead character acting or speaking after their death", () => {
    const acting = runStoryCheck(input(book(["Tomas walked into the room."])))
    expect(acting.find((i) => i.rule === "dead-appears")?.location?.chapterId).toBe("c4")
    const speaking = runStoryCheck(input(book(["“Keep going,” said Tomas."])))
    expect(rulesOf(speaking)).toContain("dead-appears")
    const alias = runStoryCheck(input(book(["the Captain nodded slowly."])))
    expect(rulesOf(alias)).toContain("dead-appears")
  })

  it("allows memories, talk about them, and flashback chapters", () => {
    const issues = runStoryCheck(
      input(
        book([
          "Mara remembered how Tomas laughed.",
          "“Tomas would have hated this,” Mara said.",
          "Tomas was dead, and nothing would change that.",
          "Tomas's sword hung on the wall.",
        ])
      )
    )
    expect(rulesOf(issues)).not.toContain("dead-appears")
    const flashback = runStoryCheck(input(book(["Tomas walked into the room."], { flashback: true })))
    expect(rulesOf(flashback)).not.toContain("dead-appears")
  })
})

describe("name spelling", () => {
  const names = (paragraphs: string[]) =>
    runStoryCheck(input([chapter("c1", 0, ["Katherine waited. Katherine paced. Katherine sat.", "They rode to Harrowgate. Harrowgate was cold.", ...paragraphs])]))

  it("flags a near-miss of a known name", () => {
    const drift = names(["Then Kathrine spoke."]).filter((i) => i.rule === "name-drift")
    expect(drift).toHaveLength(1)
    expect(drift[0].location?.quote).toBe("Kathrine")
    expect(names(["They left Harowgate at dawn."]).some((i) => i.rule === "name-drift")).toBe(true)
  })

  it("leaves ordinary words and unrelated names alone", () => {
    const issues = names(["Later they marked the map. Marked by fate, Mark went home. Katherines are common.", "Kevin arrived."])
    expect(rulesOf(issues)).not.toContain("name-drift")
  })

  it("respects ignored names", () => {
    const issues = runStoryCheck(
      input([chapter("c1", 0, ["Katherine waited. Katherine sat. Kathrine smiled."])], {
        settings: { ...DEFAULT_STORY_CHECK_SETTINGS, ignoredNames: ["Kathrine"] },
      })
    )
    expect(rulesOf(issues)).not.toContain("name-drift")
  })
})

describe("forgotten characters", () => {
  it("flags a supporting character missing for N chapters, not minor ones", () => {
    const chapters = [
      chapter("c0", 0, ["Mara met Katherine and Tomas."]),
      ...Array.from({ length: 9 }, (_, i) => chapter(`f${i}`, i + 1, ["Mara walked on."])),
    ]
    const alive = { ...TOMAS, status: "" as const, statusChapterId: undefined }
    const issues = runStoryCheck(input(chapters, { characters: [MARA, alive, KATHERINE] }))
    const forgot = issues.filter((i) => i.rule === "forgotten")
    expect(forgot.map((i) => i.entity?.id)).toEqual(["tomas"])
    expect(forgot[0].severity).toBe("info")
  })

  it("uses the configured number of chapters", () => {
    const chapters = [chapter("c0", 0, ["Mara met Tomas."]), chapter("c1", 1, ["Mara alone."]), chapter("c2", 2, ["Mara alone."])]
    const alive = { ...TOMAS, status: "" as const, statusChapterId: undefined }
    const settings = { ...DEFAULT_STORY_CHECK_SETTINGS, forgottenAfterChapters: 2 }
    expect(rulesOf(runStoryCheck(input(chapters, { characters: [MARA, alive], settings })))).toContain("forgotten")
  })
})

describe("open plot threads", () => {
  const chapters = (lastMention: number) =>
    Array.from({ length: 8 }, (_, i) => chapter(`c${i}`, i, [i <= lastMention ? "They planned the heist." : "Mara rested."]))

  it("warns when an open thread drops out of the last quarter", () => {
    const issue = runStoryCheck(input(chapters(3))).find((i) => i.rule === "open-thread")
    expect(issue?.severity).toBe("warning")
    expect(issue?.location?.chapterId).toBe("c3")
  })

  it("only notes it when still in play, and is silent once resolved", () => {
    expect(runStoryCheck(input(chapters(7))).find((i) => i.rule === "open-thread")?.severity).toBe("info")
    const resolved = runStoryCheck(input(chapters(3), { threads: [{ id: "heist", title: "the heist", aliases: [], status: "active", resolvedChapterId: "c3" }] }))
    expect(rulesOf(resolved)).not.toContain("open-thread")
  })
})

describe("ages and dates", () => {
  it("flags an age that doesn't fit the birth year and chapter date", () => {
    const issues = runStoryCheck(input([chapter("c1", 0, ["Mara was seventeen that winter."], { storyDate: "2015" })]))
    const t = issues.find((i) => i.rule === "timeline")
    expect(t?.message).toMatch(/about 25 in 2015/)
    expect(t?.location?.quote).toBe("Mara was seventeen")
  })

  it("accepts a year either way, other phrasings, and ignores measurements or undated chapters", () => {
    const ok = runStoryCheck(
      input([
        chapter("c1", 0, ["The 25-year-old Mara Vale smiled. Mara, 26, laughed. Mara was 6 feet away."], { storyDate: "2015-06-01" }),
        chapter("c2", 1, ["Mara was nine."]),
      ])
    )
    expect(rulesOf(ok)).not.toContain("timeline")
  })
})

describe("the whole book", () => {
  const clean = [
    chapter("c1", 0, ["Mara Vale had green eyes and black hair. Katherine waited at Harrowgate. They planned the heist."], { storyDate: "2015" }),
    chapter("c2", 1, ["“Hold the rope,” said Tomas. Mara, 25, held it. Katherine laughed."], { storyDate: "2015-03" }),
    chapter("c3", 2, ["Tomas fell. Katherine screamed."]),
    chapter("c4", 3, ["Mara remembered Tomas. Her green eyes stung. The heist was done."]),
  ]

  it("raises nothing on a clean manuscript", () => {
    const threads = [{ id: "heist", title: "the heist", aliases: [], status: "resolved" as const }]
    expect(runStoryCheck(input(clean, { threads }))).toEqual([])
  })

  it("finds each planted mistake once, and honours ignores", () => {
    const seeded = [
      chapter("c1", 0, ["Mara Vale had blue eyes. Katherine waited at Harrowgate. They planned the heist."], { storyDate: "2015" }),
      chapter("c2", 1, ["“Hold the rope,” said Tomas. Mara, 19, held it. Kathrine laughed."], { storyDate: "2015-03" }),
      chapter("c3", 2, ["Tomas fell. Katherine screamed. Katherine wept."]),
      chapter("c4", 3, ["Tomas smiled at her. Mara rested."]),
    ]
    const issues = runStoryCheck(input(seeded))
    expect(new Set(rulesOf(issues))).toEqual(new Set(["fact-conflict", "timeline", "name-drift", "dead-appears", "open-thread"]))
    expect(issues[0].severity).toBe("warning")

    const fact = issues.find((i) => i.rule === "fact-conflict")!
    const settings = {
      ...DEFAULT_STORY_CHECK_SETTINGS,
      ignoredIssues: [fact.key],
      ignoredRules: { tomas: ["dead-appears"] },
    }
    const after = rulesOf(runStoryCheck(input(seeded, { settings })))
    expect(after).not.toContain("fact-conflict")
    expect(after).not.toContain("dead-appears")
    expect(after).toContain("timeline")
  })
})
