import { Extension } from "@tiptap/core"
import { Plugin, PluginKey } from "@tiptap/pm/state"
import { Decoration, DecorationSet } from "@tiptap/pm/view"

/**
 * Marks the top-level block containing the current selection with a class.
 * The editor wrapper toggles a "focus-mode" class that dims every sibling
 * block via CSS — see .focus-mode rules in globals.css.
 */
export const FocusMode = Extension.create({
  name: "focusMode",

  addProseMirrorPlugins() {
    const pluginKey = new PluginKey("focusMode")

    return [
      new Plugin({
        key: pluginKey,
        props: {
          decorations(state) {
            const { doc, selection } = state
            const decorations: Decoration[] = []

            doc.forEach((node, offset) => {
              const from = offset
              const to = offset + node.nodeSize
              if (selection.from >= from && selection.from <= to) {
                decorations.push(
                  Decoration.node(from, to, { class: "is-focused-block" })
                )
              }
            })

            return DecorationSet.create(doc, decorations)
          },
        },
      }),
    ]
  },
})
