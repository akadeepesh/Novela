import { describe, expect, it } from "vitest"
import { getSchema } from "@tiptap/core"
import StarterKit from "@tiptap/starter-kit"
import { Node } from "@tiptap/pm/model"
import { extractBlocks } from "./text"

const p = (text?: string) => ({ type: "paragraph", ...(text ? { content: [{ type: "text", text }] } : {}) })

describe("block numbering", () => {
  it("matches ProseMirror's textblock order, so Go to text finds the right paragraph", () => {
    const json = {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "One" }] },
        p("First paragraph."),
        p(),
        { type: "blockquote", content: [p("Quoted."), p("Still quoted.")] },
        {
          type: "bulletList",
          content: [
            { type: "listItem", content: [p("Item A")] },
            { type: "listItem", content: [p("Item B"), { type: "orderedList", content: [{ type: "listItem", content: [p("Nested")] }] }] },
          ],
        },
        { type: "horizontalRule" },
        p("Last."),
      ],
    }
    const doc = Node.fromJSON(getSchema([StarterKit]), json)
    const pm: string[] = []
    doc.descendants((node) => {
      if (!node.isTextblock) return true
      pm.push(node.textContent)
      return false
    })
    expect(extractBlocks(json).map((b) => b.text)).toEqual(pm)
  })
})
