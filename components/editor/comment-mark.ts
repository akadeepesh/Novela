import { Mark, mergeAttributes } from "@tiptap/core"
import type { Node as PMNode } from "@tiptap/pm/model"

/**
 * Highlights the passage a margin comment is about. Stored in the chapter
 * JSON with the comment's id, so the anchor moves with the text as it's
 * edited. Export and the Read view ignore it.
 */
export const CommentMark = Mark.create({
  name: "comment",
  // Typing at either edge of a highlighted passage doesn't extend it.
  inclusive: false,
  excludes: "",

  addAttributes() {
    return {
      commentId: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-comment-id"),
        renderHTML: (attrs) => (attrs.commentId ? { "data-comment-id": attrs.commentId } : {}),
      },
    }
  },

  parseHTML() {
    return [{ tag: "span[data-comment-id]" }]
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { class: "comment-highlight" }), 0]
  },
})

/** Every range in the document marked for `commentId`. */
export function commentRanges(doc: PMNode, commentId: string): { from: number; to: number }[] {
  const ranges: { from: number; to: number }[] = []
  doc.descendants((node, pos) => {
    if (!node.isText) return true
    if (node.marks.some((m) => m.type.name === "comment" && m.attrs.commentId === commentId)) {
      const last = ranges[ranges.length - 1]
      if (last && last.to === pos) last.to = pos + node.nodeSize
      else ranges.push({ from: pos, to: pos + node.nodeSize })
    }
    return false
  })
  return ranges
}
