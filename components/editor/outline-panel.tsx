"use client"

import { useEffect, useState } from "react"
import type { Editor } from "@tiptap/react"
import { TextSelection } from "@tiptap/pm/state"
import { TreeStructureIcon, XIcon } from "@phosphor-icons/react/dist/ssr"
import { cn } from "cn"

type Entry = { pos: number; kind: "heading" | "scene"; level: number; text: string }

const PREVIEW_WORDS = 8

function preview(text: string) {
  const words = text.trim().split(/\s+/).filter(Boolean)
  return words.slice(0, PREVIEW_WORDS).join(" ") + (words.length > PREVIEW_WORDS ? "…" : "")
}

/** Headings and scene breaks in the chapter, each opening with its first words. */
function buildOutline(editor: Editor): Entry[] {
  const entries: Entry[] = []
  let sceneNumber = 1
  let awaitingScene: Entry | null = null
  editor.state.doc.forEach((node, offset) => {
    if (node.type.name === "heading") {
      entries.push({ pos: offset, kind: "heading", level: node.attrs.level as number, text: node.textContent || "Untitled heading" })
      awaitingScene = null
    } else if (node.type.name === "horizontalRule") {
      sceneNumber += 1
      awaitingScene = { pos: offset, kind: "scene", level: 0, text: `Scene ${sceneNumber}` }
      entries.push(awaitingScene)
    } else if (awaitingScene && node.textContent.trim()) {
      awaitingScene.text = `Scene ${sceneNumber}: ${preview(node.textContent)}`
      awaitingScene = null
    }
  })
  return entries
}

/** A clickable map of the chapter: jump between scenes and headings. */
export function OutlinePanel({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const [entries, setEntries] = useState(() => buildOutline(editor))

  useEffect(() => {
    const update = () => setEntries(buildOutline(editor))
    editor.on("update", update)
    return () => {
      editor.off("update", update)
    }
  }, [editor])

  function jump(pos: number) {
    // Into the first text after the heading/break, then scroll there.
    const target = Math.min(pos + 1, editor.state.doc.content.size)
    const selection = TextSelection.near(editor.state.doc.resolve(target))
    editor.view.dispatch(editor.state.tr.setSelection(selection).scrollIntoView())
    editor.commands.focus()
  }

  return (
    <div className="flex h-full w-72 shrink-0 flex-col border-l border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          <TreeStructureIcon className="size-4" />
          Outline
        </p>
        <button type="button" onClick={onClose} aria-label="Close outline" className="text-muted-foreground hover:text-foreground">
          <XIcon className="size-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {entries.length === 0 ? (
          <p className="px-2 py-1 text-xs text-muted-foreground">
            Add headings or scene breaks (the ✱ button) and they&apos;ll show up here as a map of the chapter.
          </p>
        ) : (
          <ul className="flex flex-col">
            <li>
              <button
                type="button"
                onClick={() => jump(0)}
                className="w-full rounded px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                Beginning
              </button>
            </li>
            {entries.map((e) => (
              <li key={`${e.kind}-${e.pos}`}>
                <button
                  type="button"
                  onClick={() => jump(e.pos)}
                  className={cn(
                    "w-full truncate rounded px-2 py-1.5 text-left hover:bg-muted",
                    e.kind === "heading" ? "text-sm font-medium text-foreground" : "text-xs text-muted-foreground",
                    e.kind === "heading" && e.level >= 3 && "pl-5 text-[13px]"
                  )}
                  title={e.text}
                >
                  {e.text}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
