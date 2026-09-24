"use client"

import { useState } from "react"
import { LinkIcon } from "@phosphor-icons/react/dist/ssr"
import { Button } from "@/components/ui/button"
import type { SerializedResearchEntrySummary } from "@/lib/research-entries"
import { createLinkEntryAction, createQuickNoteEntryAction } from "./actions"

/**
 * The Research board's single entry point (Part 7.2, option b): paste a
 * URL and it becomes a preview card automatically. A "quick note" fallback
 * stays available for offline research — a book, a conversation, anything
 * without a link.
 */
export function ResearchComposer({
  projectId,
  onCreated,
}: {
  projectId: string
  onCreated: (entry: SerializedResearchEntrySummary) => void
}) {
  const [mode, setMode] = useState<"url" | "note">("url")
  const [url, setUrl] = useState("")
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function resetNote() {
    setTitle("")
    setContent("")
  }

  async function handleUrlSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!url.trim() || pending) return
    setPending(true)
    setError(null)
    const result = await createLinkEntryAction(projectId, url.trim())
    setPending(false)
    if (result.ok && result.entry) {
      onCreated(result.entry)
      setUrl("")
    } else {
      setError(result.error ?? "Couldn't fetch that link.")
    }
  }

  async function handleNoteSubmit() {
    if ((!title.trim() && !content.trim()) || pending) return
    setPending(true)
    const result = await createQuickNoteEntryAction(projectId, { title, content })
    setPending(false)
    if (result.ok && result.entry) {
      onCreated(result.entry)
      resetNote()
      setMode("url")
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card px-5 py-4 shadow-xs">
      {mode === "url" ? (
        <form onSubmit={handleUrlSubmit} className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <LinkIcon className="size-4 shrink-0 text-muted-foreground" />
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste a URL to save it…"
              className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              disabled={pending}
            />
            <Button type="submit" size="sm" disabled={pending || !url.trim()}>
              {pending ? "Fetching…" : "Save"}
            </Button>
          </div>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          <button
            type="button"
            onClick={() => setMode("note")}
            className="w-fit text-xs text-muted-foreground hover:text-foreground"
          >
            or add a quick note instead
          </button>
        </form>
      ) : (
        <div className="flex flex-col gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (optional)"
            className="w-full bg-transparent font-heading text-sm font-semibold text-foreground outline-none placeholder:font-normal placeholder:text-muted-foreground"
            autoFocus
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="A book, a conversation, anything without a link…"
            rows={3}
            className="w-full resize-none bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <div className="flex items-center justify-end gap-2 border-t border-border pt-2.5">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                resetNote()
                setMode("url")
              }}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={handleNoteSubmit} disabled={pending}>
              {pending ? "Saving…" : "Add note"}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
