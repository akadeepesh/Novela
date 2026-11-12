import { Node, mergeAttributes } from "@tiptap/core"
import { ReactNodeViewRenderer, ReactRenderer } from "@tiptap/react"
import Suggestion from "@tiptap/suggestion"
import { MentionList, type MentionListRef } from "./mention-list"
import { MentionNodeView } from "./mention-node-view"
import type { Mentionable } from "@/lib/store/mentions"

export type MentionExtensionOptions = {
  mentionables: Mentionable[]
}

function positionPopup(popup: HTMLDivElement, clientRect?: (() => DOMRect | null) | null) {
  const rect = clientRect?.()
  if (!rect) return
  popup.style.left = `${rect.left}px`
  popup.style.top = `${rect.bottom + 6}px`
}

export const MentionExtension = Node.create<MentionExtensionOptions>({
  name: "mention",
  group: "inline",
  inline: true,
  atom: true,
  selectable: false,

  addOptions() {
    return {
      mentionables: [],
    }
  },

  addAttributes() {
    return {
      id: { default: null },
      label: { default: null },
      entityType: { default: null },
      preview: { default: null },
    }
  },

  parseHTML() {
    return [{ tag: "span[data-mention]" }]
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-mention": "",
        "data-entity-type": node.attrs.entityType,
      }),
      `@${node.attrs.label}`,
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(MentionNodeView)
  },

  addProseMirrorPlugins() {
    const mentionables = this.options.mentionables

    return [
      Suggestion({
        editor: this.editor,
        char: "@",
        allowSpaces: false,
        items: ({ query }) => {
          if (!query) return mentionables.slice(0, 8)
          const q = query.toLowerCase()
          return mentionables
            .filter(
              (m) =>
                m.label.toLowerCase().includes(q) ||
                m.aliases.some((alias) => alias.toLowerCase().includes(q))
            )
            .slice(0, 8)
        },
        command: ({ editor, range, props }) => {
          const item = props as Mentionable
          editor
            .chain()
            .focus()
            .insertContentAt(range, [
              {
                type: "mention",
                attrs: {
                  id: item.id,
                  label: item.label,
                  entityType: item.type,
                  preview: item.preview,
                },
              },
              { type: "text", text: " " },
            ])
            .run()
        },
        render: () => {
          let component: ReactRenderer<MentionListRef>
          let popup: HTMLDivElement | null = null

          return {
            onStart: (props) => {
              component = new ReactRenderer(MentionList, {
                props,
                editor: props.editor,
              })
              popup = document.createElement("div")
              popup.style.position = "fixed"
              popup.style.zIndex = "60"
              document.body.appendChild(popup)
              popup.appendChild(component.element)
              positionPopup(popup, props.clientRect)
            },
            onUpdate(props) {
              component.updateProps(props)
              if (popup) positionPopup(popup, props.clientRect)
            },
            onKeyDown(props) {
              if (props.event.key === "Escape") {
                popup?.remove()
                popup = null
                return true
              }
              return component.ref?.onKeyDown(props) ?? false
            },
            onExit() {
              popup?.remove()
              popup = null
              component?.destroy()
            },
          }
        },
      }),
    ]
  },
})
