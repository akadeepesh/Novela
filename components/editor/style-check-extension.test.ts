import { describe, expect, it } from "vitest"
import { getSchema } from "@tiptap/core"
import StarterKit from "@tiptap/starter-kit"
import { Node as PMNode } from "@tiptap/pm/model"
import { extractBlocks } from "@/lib/story-check/text"
import { analyzeStyle } from "@/lib/style-check/rules"
import { DEFAULT_STYLE_SETTINGS } from "@/lib/style-check/types"
import { docBlocks } from "./style-check-extension"

const schema = getSchema([StarterKit])

const json = {
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "One" }] },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "She " },
        { type: "text", text: "really", marks: [{ type: "bold" }] },
        { type: "text", text: " ran." },
        { type: "hardBreak" },
        { type: "text", text: "The door was opened slowly." },
      ],
    },
    { type: "blockquote", content: [{ type: "paragraph", content: [{ type: "text", text: "It was just a dream." }] }] },
  ],
}

describe("docBlocks", () => {
  const doc = PMNode.fromJSON(schema, json)
  const blocks = docBlocks(doc)

  it("sees the same text, in the same order, as Story Check", () => {
    expect(blocks.map((b) => b.block.text)).toEqual(extractBlocks(json).map((b) => b.text))
  })

  it("maps every finding back onto exactly its words in the document", () => {
    const findings = analyzeStyle(
      blocks.map((b) => b.block),
      { settings: DEFAULT_STYLE_SETTINGS }
    )
    expect(findings.length).toBeGreaterThanOrEqual(4)
    for (const f of findings) {
      const map = blocks[f.blockIndex].map
      expect(doc.textBetween(map[f.start], map[f.end - 1] + 1, "\n", "\n")).toBe(f.quote)
    }
  })
})
