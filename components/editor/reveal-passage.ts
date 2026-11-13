import type { Editor } from "@tiptap/react"
import { TextSelection } from "@tiptap/pm/state"

/**
 * Selects and scrolls to `quote` inside the `blockIndex`-th textblock (the
 * numbering Story Check uses), falling back to the first match anywhere in
 * the chapter if the text has moved since the check ran. An @mention counts
 * as its label. Returns false if the passage can't be found.
 */
export function revealPassage(editor: Editor, blockIndex: number | undefined, quote: string | undefined): boolean {
  const doc = editor.state.doc
  type Found = { from: number; to: number }
  const blocks: { pos: number; text: string; map: number[] }[] = []

  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true
    // Build the block's text as Story Check sees it, remembering where each
    // character sits in the document.
    let text = ""
    const map: number[] = []
    let offset = pos + 1
    node.forEach((child) => {
      if (child.isText) {
        for (let i = 0; i < child.text!.length; i++) map.push(offset + i)
        text += child.text
      } else {
        const label = child.type.name === "mention" ? String(child.attrs.label ?? "") : " "
        for (let i = 0; i < label.length; i++) map.push(offset)
        text += label
      }
      offset += child.nodeSize
    })
    blocks.push({ pos, text, map })
    return false
  })

  const find = (b: (typeof blocks)[number]): Found | null => {
    if (!quote) return null
    const i = b.text.indexOf(quote)
    if (i < 0) return null
    const last = b.map[i + quote.length - 1]
    return { from: b.map[i], to: last + 1 }
  }

  let found: Found | null = null
  if (blockIndex !== undefined && blocks[blockIndex]) {
    found = find(blocks[blockIndex])
    if (!found && !quote) found = { from: blocks[blockIndex].pos + 1, to: blocks[blockIndex].pos + 1 }
  }
  if (!found) for (const b of blocks) if ((found = find(b))) break
  if (!found) return false

  try {
    editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(doc, found.from, found.to)).scrollIntoView())
    editor.commands.focus()
    return true
  } catch {
    return false
  }
}
