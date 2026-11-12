"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { PushPinIcon, TrashIcon } from "@phosphor-icons/react/dist/ssr"
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog"
import { ChipInput } from "@/components/ui/chip-input"
import { cn } from "cn"
import { createActionQueue } from "@/lib/action-queue"
import type { SerializedNoteSummary } from "@/lib/store/notes"
import { saveNoteAction, deleteNoteAction, togglePinNoteAction } from "./actions"

const SAVE_DEBOUNCE_MS = 700
// Match the server's limits (notes/actions.ts) so an over-long note is
// stopped while typing instead of silently failing to save.
const MAX_TITLE = 160
const MAX_CONTENT = 20_000

type NotePatch = { title?: string; content?: string; tags?: string[] }

/**
 * A note, editable in place. Click anywhere in the body and the title and
 * content become real inputs; typing autosaves on a short debounce, and
 * clicking away outside the card commits immediately and drops back to
 * the plain read view — no Save button anywhere (Part 7.1).
 */
export function NoteCard({
  projectId,
  note,
  onSaved,
  onDeleted,
}: {
  projectId: string
  note: SerializedNoteSummary
  onSaved: (note: SerializedNoteSummary) => void
  onDeleted: (id: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(note.title)
  const [content, setContent] = useState(note.content ?? "")
  const [tags, setTags] = useState(note.tags)
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletePending, setDeletePending] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Each card gets its own queue so its saves stay ordered even if a
  // debounced content save and a tag edit land moments apart — see
  // lib/action-queue.ts.
  const enqueue = useMemo(() => createActionQueue(), [])

  // Stay in sync with the server copy while not actively being edited —
  // e.g. after the grid re-sorts on a pin toggle. Adjusting state directly
  // during render (rather than in a useEffect) avoids an extra render
  // pass — see https://react.dev/learn/you-might-not-need-an-effect
  const [prevNote, setPrevNote] = useState(note)
  if (!editing && note !== prevNote) {
    setPrevNote(note)
    setTitle(note.title)
    setContent(note.content ?? "")
    setTags(note.tags)
  }

  // Every field changed since the last save, merged. Editing the title and
  // then the content within one debounce window sends both, not just the last.
  const pending = useRef<NotePatch>({})
  const noteRef = useRef(note)
  const onSavedRef = useRef(onSaved)
  useEffect(() => {
    noteRef.current = note
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
    setSaveState("saving")
    void enqueue(() => saveNoteAction(projectId, noteRef.current.id, patch))
      .catch(() => ({ ok: false }))
      .then((result) => {
        if (result.ok) {
          setSaveState("saved")
          onSavedRef.current({ ...noteRef.current, ...patch })
        } else {
          // Keep it pending (newer edits win) so the next change retries it.
          pending.current = { ...patch, ...pending.current }
          setSaveState("error")
        }
      })
  }, [enqueue, projectId])

  function scheduleSave(change: NotePatch) {
    pending.current = { ...pending.current, ...change }
    setSaveState("saving")
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

  function handleTogglePin() {
    const pinned = !note.pinned
    onSaved({ ...note, pinned })
    togglePinNoteAction(projectId, note.id, pinned)
  }

  function handleConfirmDelete() {
    setDeletePending(true)
    deleteNoteAction(projectId, note.id).then(() => onDeleted(note.id))
  }

  return (
    <div
      ref={containerRef}
      onBlurCapture={handleBlurCapture}
      className={cn(
        "group relative flex flex-col gap-3 rounded-xl border border-border bg-card py-4 shadow-xs transition-colors",
        editing && "ring-1 ring-ring/40"
      )}
    >
      <div className="absolute top-3.5 right-4 z-10 flex items-center gap-2">
        <button
          type="button"
          onClick={handleTogglePin}
          className={
            note.pinned
              ? "text-primary"
              : "text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
          }
          aria-label={note.pinned ? "Unpin note" : "Pin note"}
        >
          <PushPinIcon className="size-4" weight={note.pinned ? "fill" : "regular"} />
        </button>
        <button
          type="button"
          onClick={() => setDeleteOpen(true)}
          className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
          aria-label={`Delete ${title}`}
        >
          <TrashIcon className="size-4" />
        </button>
      </div>

      <div className="px-5" onClick={() => setEditing(true)}>
        {editing ? (
          <input
            className="w-full bg-transparent pr-14 font-heading text-base font-semibold text-card-foreground outline-none"
            value={title}
            maxLength={MAX_TITLE}
            onChange={(e) => {
              setTitle(e.target.value)
              scheduleSave({ title: e.target.value })
            }}
            placeholder="Title"
          />
        ) : (
          <p className="cursor-text pr-14 font-heading text-base font-semibold text-card-foreground">
            {title}
          </p>
        )}
      </div>

      <div className="px-5" onClick={() => setEditing(true)}>
        {editing ? (
          <textarea
            className="w-full resize-none bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            rows={5}
            value={content}
            maxLength={MAX_CONTENT}
            onChange={(e) => {
              setContent(e.target.value)
              scheduleSave({ content: e.target.value })
            }}
            placeholder="Write it down before you lose it…"
            autoFocus
          />
        ) : (
          <p className="line-clamp-4 cursor-text whitespace-pre-line text-sm text-muted-foreground">
            {content || <span className="italic">Empty</span>}
          </p>
        )}
      </div>

      {editing || tags.length > 0 || saveState === "error" ? (
        <div className="flex items-center justify-between gap-2 px-5">
          <ChipInput
            tags={tags}
            onChange={(next) => {
              setTags(next)
              scheduleSave({ tags: next })
            }}
            editing={editing}
          />
          {saveState === "error" ? (
            <span role="alert" className="shrink-0 text-[11px] text-destructive">
              Couldn&apos;t save. Will retry on your next change.
            </span>
          ) : editing && saveState === "saving" ? (
            <span className="shrink-0 text-[11px] text-muted-foreground">Saving…</span>
          ) : null}
        </div>
      ) : null}

      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        itemName={title}
        itemLabel="note"
        onConfirm={handleConfirmDelete}
        pending={deletePending}
      />
    </div>
  )
}
