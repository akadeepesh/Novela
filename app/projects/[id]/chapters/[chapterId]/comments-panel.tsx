"use client"

import { useEffect, useState } from "react"
import type { Editor } from "@tiptap/react"
import { TextSelection } from "@tiptap/pm/state"
import { XIcon, ChatTeardropTextIcon } from "@phosphor-icons/react/dist/ssr"
import { Button } from "@/components/ui/button"
import { commentRanges } from "@/components/editor/comment-mark"
import type { SerializedComment } from "@/lib/store/comments"
import type { ActionQueue } from "@/lib/action-queue"
import {
  createOwnerCommentAction,
  deleteCommentAction,
  listChapterCommentsAction,
  setCommentResolvedAction,
} from "./comment-actions"

export type CommentDraft = { from: number; to: number; quote: string }

function formatTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
}

/** Removes a comment's highlight from the text (resolving or deleting it). */
function unmark(editor: Editor, commentId: string) {
  const ranges = commentRanges(editor.state.doc, commentId)
  if (ranges.length === 0) return
  const type = editor.schema.marks.comment
  const tr = editor.state.tr
  for (const r of ranges) tr.removeMark(r.from, r.to, type)
  editor.view.dispatch(tr)
}

/** Selects and scrolls to what a comment is about. */
function reveal(editor: Editor, comment: SerializedComment) {
  let range: { from: number; to: number } | undefined = commentRanges(editor.state.doc, comment.id)[0]
  // Reader comments (and resolved notes) have no mark: find the quoted passage instead.
  if (!range && comment.quote) {
    editor.state.doc.descendants((node, pos) => {
      if (range || !node.isTextblock) return !range
      const i = node.textContent.indexOf(comment.quote.slice(0, 120))
      if (i >= 0) range = { from: pos + 1 + i, to: pos + 1 + i + Math.min(comment.quote.length, 120) }
      return false
    })
  }
  if (!range) return false
  try {
    editor.view.dispatch(
      editor.state.tr.setSelection(TextSelection.create(editor.state.doc, range.from, range.to)).scrollIntoView()
    )
    editor.commands.focus()
    return true
  } catch {
    return false
  }
}

export function CommentsPanel({
  editor,
  projectId,
  chapterId,
  draft,
  onDraftDone,
  enqueue,
  onClose,
}: {
  editor: Editor
  projectId: string
  chapterId: string
  draft: CommentDraft | null
  onDraftDone: () => void
  enqueue: ActionQueue
  onClose: () => void
}) {
  const [comments, setComments] = useState<SerializedComment[] | null>(null)
  const [body, setBody] = useState("")
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [showResolved, setShowResolved] = useState(false)

  useEffect(() => {
    let cancelled = false
    void listChapterCommentsAction(projectId, chapterId).then((result) => {
      if (cancelled) return
      if (result.ok) setComments(result.comments)
      else setNotice("Couldn't load comments. Close and reopen this panel to try again.")
    })
    return () => {
      cancelled = true
    }
  }, [projectId, chapterId])

  async function save() {
    if (!draft || !body.trim()) return
    setBusy(true)
    setNotice(null)
    const result = await createOwnerCommentAction(projectId, chapterId, { body, quote: draft.quote }).catch(() => null)
    setBusy(false)
    if (!result?.ok) {
      setNotice(result?.error ?? "Couldn't save the comment.")
      return
    }
    // Mark the passage; the editor's autosave stores the mark with the text.
    const { from, to } = draft
    const max = editor.state.doc.content.size
    if (from < to && to <= max) {
      editor.view.dispatch(
        editor.state.tr.addMark(from, to, editor.schema.marks.comment.create({ commentId: result.comment.id }))
      )
    }
    setComments((prev) => [...(prev ?? []), result.comment])
    setBody("")
    onDraftDone()
  }

  function setResolved(comment: SerializedComment, resolved: boolean) {
    setComments((prev) => prev?.map((c) => (c.id === comment.id ? { ...c, resolved } : c)) ?? prev)
    if (resolved) unmark(editor, comment.id)
    void enqueue(() => setCommentResolvedAction(projectId, comment.id, resolved)).then((r) => {
      if (!r.ok) setNotice("Couldn't update that comment.")
    })
  }

  function remove(comment: SerializedComment) {
    setComments((prev) => prev?.filter((c) => c.id !== comment.id) ?? prev)
    unmark(editor, comment.id)
    void enqueue(() => deleteCommentAction(projectId, comment.id)).then((r) => {
      if (!r.ok) setNotice("Couldn't delete that comment.")
    })
  }

  const open = comments?.filter((c) => !c.resolved) ?? []
  const resolved = comments?.filter((c) => c.resolved) ?? []

  return (
    <div className="flex h-full w-80 shrink-0 flex-col border-l border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          <ChatTeardropTextIcon className="size-4" />
          Comments
        </p>
        <button type="button" onClick={onClose} aria-label="Close comments" className="text-muted-foreground hover:text-foreground">
          <XIcon className="size-4" />
        </button>
      </div>

      {draft ? (
        <div className="flex flex-col gap-2 border-b border-border px-4 py-3">
          <p className="line-clamp-3 border-l-2 border-primary/50 pl-2 text-xs text-muted-foreground italic">{draft.quote}</p>
          <textarea
            autoFocus
            value={body}
            maxLength={2000}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void save()
            }}
            rows={3}
            placeholder="Note to self…"
            className="w-full resize-none rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={onDraftDone} disabled={busy}>
              Cancel
            </Button>
            <Button size="sm" onClick={save} disabled={busy || !body.trim()}>
              {busy ? "Saving…" : "Comment"}
            </Button>
          </div>
        </div>
      ) : null}

      {notice ? (
        <p role="alert" className="border-b border-border px-4 py-2 text-xs text-destructive">
          {notice}
        </p>
      ) : null}

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {comments === null ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : open.length === 0 && !draft ? (
          <p className="text-xs text-muted-foreground">
            No open comments. Select some text and press the comment button to leave yourself a note.
          </p>
        ) : null}

        <ul className="flex flex-col gap-3">
          {open.map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              onReveal={() => {
                if (!reveal(editor, c)) setNotice("That passage has changed or been removed.")
              }}
              onResolve={() => setResolved(c, true)}
              onDelete={() => remove(c)}
            />
          ))}
        </ul>

        {resolved.length > 0 ? (
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setShowResolved((v) => !v)}
              className="text-[11px] font-medium text-muted-foreground hover:text-foreground"
            >
              {showResolved ? "Hide" : "Show"} resolved ({resolved.length})
            </button>
            {showResolved ? (
              <ul className="mt-2 flex flex-col gap-3 opacity-70">
                {resolved.map((c) => (
                  <CommentItem
                    key={c.id}
                    comment={c}
                    onReveal={() => {
                      if (!reveal(editor, c)) setNotice("That passage has changed or been removed.")
                    }}
                    onReopen={() => setResolved(c, false)}
                    onDelete={() => remove(c)}
                  />
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function CommentItem({
  comment,
  onReveal,
  onResolve,
  onReopen,
  onDelete,
}: {
  comment: SerializedComment
  onReveal: () => void
  onResolve?: () => void
  onReopen?: () => void
  onDelete: () => void
}) {
  return (
    <li className="rounded-md border border-border p-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-medium text-foreground">
          You
        </p>
        <p className="text-[11px] text-muted-foreground">{formatTime(comment.createdAt)}</p>
      </div>
      {comment.quote ? (
        <button
          type="button"
          onClick={onReveal}
          className="mt-1 line-clamp-2 border-l-2 border-primary/40 pl-2 text-left text-[11px] text-muted-foreground italic hover:text-foreground"
        >
          {comment.quote}
        </button>
      ) : null}
      <p className="mt-1.5 text-sm whitespace-pre-line text-foreground">{comment.body}</p>
      <div className="mt-2 flex items-center gap-3">
        {onResolve ? (
          <button type="button" onClick={onResolve} className="text-[11px] font-medium text-primary hover:underline">
            Resolve
          </button>
        ) : null}
        {onReopen ? (
          <button type="button" onClick={onReopen} className="text-[11px] font-medium text-primary hover:underline">
            Reopen
          </button>
        ) : null}
        <button type="button" onClick={onDelete} className="text-[11px] font-medium text-muted-foreground hover:text-destructive">
          Delete
        </button>
      </div>
    </li>
  )
}
