"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ArrowSquareOutIcon, NotePencilIcon, TrashIcon } from "@phosphor-icons/react/dist/ssr"
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog"
import { cn } from "cn"
import { createActionQueue } from "@/lib/action-queue"
import type { SerializedResearchEntrySummary } from "@/lib/research-entries"
import { deleteResearchEntryAction, saveResearchEntryFieldsAction } from "./actions"

const SAVE_DEBOUNCE_MS = 700
// Match the server's limits (research/actions.ts) so an over-long entry is
// stopped while typing instead of silently failing to save.
const MAX_TITLE = 160
const MAX_CONTENT = 8000

type EntryPatch = { title?: string; content?: string }

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

/**
 * A single card on the Research source board (Part 7.2). Renders three
 * ways depending on the entry:
 *  - "link": the fetched preview image/title, non-editable (it came from
 *    the page itself) — clicking it opens the source. The caption below
 *    is editable in place, same pattern as a Note.
 *  - "image": a legacy manually-pasted image URL, from before this pass —
 *    still supported, edited like a note with an image on top.
 *  - "note": a quick note with no URL, fully editable in place.
 */
export function ResearchEntryCard({
  projectId,
  entry,
  onSaved,
  onDeleted,
}: {
  projectId: string
  entry: SerializedResearchEntrySummary
  onSaved: (entry: SerializedResearchEntrySummary) => void
  onDeleted: (id: string) => void
}) {
  const isLink = entry.type === "link"
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(entry.title)
  const [content, setContent] = useState(entry.content ?? "")
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletePending, setDeletePending] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [saveFailed, setSaveFailed] = useState(false)
  // Saves run one at a time, in order (see lib/action-queue.ts).
  const enqueue = useMemo(() => createActionQueue(), [])

  // Stay in sync with the server copy while not actively being edited.
  // Adjusting state directly during render (rather than in a useEffect)
  // avoids an extra render pass — see
  // https://react.dev/learn/you-might-not-need-an-effect
  const [prevEntry, setPrevEntry] = useState(entry)
  if (!editing && entry !== prevEntry) {
    setPrevEntry(entry)
    setTitle(entry.title)
    setContent(entry.content ?? "")
  }

  // Every field changed since the last save, merged, so a title edit and a
  // content edit inside one debounce window are both sent.
  const pending = useRef<EntryPatch>({})
  const entryRef = useRef(entry)
  const onSavedRef = useRef(onSaved)
  useEffect(() => {
    entryRef.current = entry
    onSavedRef.current = onSaved
  })

  const flush = useCallback(() => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current)
      saveTimer.current = null
    }
    const patch = pending.current
    if (Object.keys(patch).length === 0) return
    pending.current = {}
    void enqueue(() => saveResearchEntryFieldsAction(projectId, entryRef.current.id, patch))
      .catch(() => ({ ok: false }))
      .then((result) => {
        if (result.ok) {
          setSaveFailed(false)
          onSavedRef.current({ ...entryRef.current, ...patch })
        } else {
          // Keep it pending (newer edits win) so the next change retries it.
          pending.current = { ...patch, ...pending.current }
          setSaveFailed(true)
        }
      })
  }, [enqueue, projectId])

  function scheduleSave(change: EntryPatch) {
    pending.current = { ...pending.current, ...change }
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(flush, SAVE_DEBOUNCE_MS)
  }

  function commitNow() {
    flush()
  }

  // Leaving the page or closing the tab mid-debounce still saves.
  useEffect(() => {
    window.addEventListener("pagehide", flush)
    return () => {
      window.removeEventListener("pagehide", flush)
      flush()
    }
  }, [flush])

  function handleBlurCapture(e: React.FocusEvent<HTMLDivElement>) {
    const next = e.relatedTarget as Node | null
    if (containerRef.current && next && containerRef.current.contains(next)) return
    if (editing) {
      setEditing(false)
      commitNow()
    }
  }

  function handleConfirmDelete() {
    setDeletePending(true)
    deleteResearchEntryAction(projectId, entry.id).then(() => onDeleted(entry.id))
  }

  return (
    <div
      ref={containerRef}
      onBlurCapture={handleBlurCapture}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xs transition-colors",
        editing && "ring-1 ring-ring/40"
      )}
    >
      <button
        type="button"
        onClick={() => setDeleteOpen(true)}
        className="absolute top-3 right-3 z-10 rounded-full bg-card/80 p-1 text-muted-foreground opacity-0 backdrop-blur-xs transition-opacity hover:text-destructive group-hover:opacity-100"
        aria-label={`Delete ${entry.title}`}
      >
        <TrashIcon className="size-4" />
      </button>

      {isLink ? (
        <a href={entry.url} target="_blank" rel="noopener noreferrer" className="block">
          {entry.imageUrl ? (
            <div className="aspect-video w-full overflow-hidden bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary external domain, can't be pre-registered with next/image */}
              <img
                src={entry.imageUrl}
                alt=""
                className="size-full object-cover transition-transform group-hover:scale-[1.03]"
                loading="lazy"
              />
            </div>
          ) : (
            <div className="flex aspect-video w-full items-center justify-center bg-muted">
              <ArrowSquareOutIcon className="size-6 text-muted-foreground/50" />
            </div>
          )}
          <div className="flex items-center gap-1.5 px-4 pt-3 text-xs text-muted-foreground">
            {entry.faviconUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- favicon service, not a next/image-eligible static asset
              <img src={entry.faviconUrl} alt="" className="size-3.5 rounded-xs" />
            ) : null}
            <span className="truncate">{entry.siteName || (entry.url ? hostnameOf(entry.url) : "")}</span>
            <ArrowSquareOutIcon className="ml-auto size-3 shrink-0" />
          </div>
          <p className="line-clamp-2 px-4 pt-1 pb-2 text-sm font-medium leading-snug text-card-foreground">
            {entry.title}
          </p>
        </a>
      ) : (
        <>
          {entry.type === "image" && entry.url ? (
            <div className="aspect-video w-full overflow-hidden bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary external domain, can't be pre-registered with next/image */}
              <img src={entry.url} alt={entry.title} className="size-full object-cover" />
            </div>
          ) : null}
          <div className="px-4 pt-4" onClick={() => setEditing(true)}>
            {editing ? (
              <input
                className="w-full bg-transparent font-heading text-sm font-semibold text-card-foreground outline-none"
                value={title}
                maxLength={MAX_TITLE}
                onChange={(e) => {
                  setTitle(e.target.value)
                  scheduleSave({ title: e.target.value })
                }}
                placeholder="Title"
                autoFocus
              />
            ) : (
              <p className="cursor-text pr-6 font-heading text-sm font-semibold text-card-foreground">
                {title}
              </p>
            )}
          </div>
        </>
      )}

      {isLink ? (
        <div className="flex items-center gap-1.5 px-4 pt-3">
          <NotePencilIcon className="size-3 text-muted-foreground" />
          <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
            Your note
          </span>
        </div>
      ) : null}

      <div className="px-4 pb-4 pt-1.5" onClick={() => setEditing(true)}>
        {editing ? (
          <textarea
            className="w-full resize-none bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground"
            rows={isLink ? 2 : 4}
            value={content}
            maxLength={MAX_CONTENT}
            onChange={(e) => {
              setContent(e.target.value)
              scheduleSave({ content: e.target.value })
            }}
            placeholder={isLink ? "Why this matters…" : "Notes…"}
            autoFocus={isLink}
          />
        ) : (
          <p
            className={cn(
              "cursor-text whitespace-pre-line text-[15px] leading-snug text-foreground",
              isLink ? "line-clamp-2" : "line-clamp-4"
            )}
          >
            {content || (
              <span className="text-sm text-muted-foreground italic">
                {isLink ? "Add a note on why this matters" : "Empty"}
              </span>
            )}
          </p>
        )}
      </div>

      {saveFailed ? (
        <p role="alert" className="px-4 pb-3 text-[11px] text-destructive">
          Couldn&apos;t save. Will retry on your next change.
        </p>
      ) : null}

      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        itemName={entry.title}
        itemLabel="entry"
        onConfirm={handleConfirmDelete}
        pending={deletePending}
      />
    </div>
  )
}
