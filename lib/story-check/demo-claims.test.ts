import { describe, expect, it } from "vitest"
import { runStoryCheck } from "./run"
import { DEFAULT_STORY_CHECK_SETTINGS, type StoryCheckInput } from "./types"

const doc = (...paras: string[]) => ({ type: "doc", content: paras.map((t) => ({ type: "paragraph", content: [{ type: "text", text: t }] })) })

/** The landing page demo and guides promise these exact catches; keep them true. */
describe("marketing claims", () => {
  const input: StoryCheckInput = {
    chapters: [
      { id: "c1", title: "The Harbour", order: 0, content: doc("Greywater slept. Mara walked the Greywater docks past the Greywater inn.") },
      { id: "c2", title: "The Fall", order: 1, content: doc("Tomas fell from the tower.") },
      { id: "c3", title: "The Return", order: 2, content: doc("The harbour at Graywater was quiet when Mara reached the end of the pier.", "“You came back,” Tomas said, stepping out of the fog.") },
    ],
    characters: [
      { id: "mara", name: "Mara Vale", aliases: [], role: "protagonist" },
      { id: "tomas", name: "Tomas", aliases: [], role: "supporting", status: "dead", statusChapterId: "c2" },
      { id: "kath", name: "Katherine", aliases: [], role: "minor" },
    ],
    places: [{ id: "gw", name: "Greywater Harbour", aliases: [] }],
    threads: [],
    settings: DEFAULT_STORY_CHECK_SETTINGS,
  }

  it("flags the dead character who speaks, and the misspelled town", () => {
    const issues = runStoryCheck(input)
    expect(issues.some((i) => i.rule === "dead-appears" && i.entity?.id === "tomas" && i.location?.chapterId === "c3")).toBe(true)
    expect(issues.some((i) => i.rule === "name-drift" && i.location?.quote === "Graywater")).toBe(true)
  })

  it("flags Katharine for Katherine, as the story bible guide says", () => {
    const issues = runStoryCheck({
      ...input,
      chapters: [
        { id: "a", title: "A", order: 0, content: doc("Katherine laughed. Katherine left. Katherine came back.") },
        { id: "b", title: "B", order: 1, content: doc("Katharine waited by the door.") },
      ],
    })
    expect(issues.some((i) => i.rule === "name-drift" && i.location?.quote === "Katharine")).toBe(true)
  })
})
