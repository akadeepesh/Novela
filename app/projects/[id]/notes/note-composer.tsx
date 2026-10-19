"use client"

import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "cn"
import type { SerializedNoteSummary } from "@/lib/notes"
import { createNoteInlineAction } from "./actions"

/**
 * The "Take a note…" input pinned at the top of the grid (Part 7.1).
 * Collapsed, it's a single line. Focusing it expands a title field and a
 * bigger content area; clicking away commits the note if there's anything
 * in it, or just collapses back to nothing if it's still blank.
 */
export function NoteComposer({
  projectId,
  onCreated,
}: {
  projectId: string
  onCreated: (note: SerializedNoteSummary) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  // A ref, not the `pending` state: a second blur can fire before React
  // re-renders, and must not create the same note twice.
  const creating = useRef(false)

  function reset() {
    setError(null)
    setTitle("")
    setContent("")
    setExpanded(false)
  }

  function commit() {
    if (creating.current) return
    if (!title.trim() && !content.trim()) {
      reset()
      return
    }
    creating.current = true
    setPending(true)
    setError(null)
    createNoteInlineAction(projectId, { title, content })
      .catch(() => ({ ok: false as const, note: undefined, error: undefined }))
      .then((result) => {
        creating.current = false
        setPending(false)
        if (result.ok && result.note) {
          onCreated(result.note)
          reset()
        } else {
          // Keep what was typed: a failed save must never throw the note away.
          setError(result.error ?? "Couldn't save the note. Try again.")
        }
      })
  }

  function handleBlurCapture(e: React.FocusEvent<HTMLDivElement>) {
    const next = e.relatedTarget as Node | null
    if (containerRef.current && next && containerRef.current.contains(next)) return
    commit()
  }

  return (
    <div
      ref={containerRef}
      onBlurCapture={handleBlurCapture}
      className={cn(
        "rounded-xl border border-border bg-card px-5 py-3.5 shadow-xs transition-colors",
        expanded && "ring-1 ring-ring/40"
      )}
    >
      {expanded ? (
        <input
          className="mb-2 w-full bg-transparent font-heading text-sm font-semibold text-foreground outline-none placeholder:font-normal placeholder:text-muted-foreground"
          placeholder="Title"
          value={title}
          maxLength={160}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
        />
      ) : null}
      <textarea
        rows={expanded ? 3 : 1}
        className="w-full resize-none bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
        placeholder="Take a note…"
        value={content}
        maxLength={20_000}
        onFocus={() => setExpanded(true)}
        onChange={(e) => {
          setContent(e.target.value)
          if (!expanded) setExpanded(true)
        }}
      />
      {expanded ? (
        <div className="mt-2 flex items-center justify-end gap-2 border-t border-border pt-2.5">
          <span className={cn("mr-auto text-xs", error && !pending ? "text-destructive" : "text-muted-foreground")}>
            {pending ? "Saving…" : (error ?? "")}
          </span>
          <Button type="button" size="sm" variant="ghost" onClick={reset} disabled={pending}>
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={commit} disabled={pending}>
            Done
          </Button>
        </div>
      ) : null}
    </div>
  )
}
