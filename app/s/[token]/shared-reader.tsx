"use client"

import { useEffect, useState } from "react"
import { ChatTeardropTextIcon } from "@phosphor-icons/react/dist/ssr"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import type { ExportDocument } from "@/lib/export/document-model"
import type { ManuscriptSettings } from "@/lib/manuscript-config"
import type { ProjectType } from "@/lib/project-config"
import { ReadView } from "@/app/read/[id]/read-view"
import { addReaderCommentAction } from "./actions"

const NAME_KEY = "korakagaj-reader-name"

/** The book as a beta reader sees it, with a "Comment" button when the writer allows it. */
export function SharedReader({
  token,
  allowComments,
  doc,
  projectType,
  manuscriptSettings,
  coverFrontUrl,
  coverBackUrl,
}: {
  token: string
  allowComments: boolean
  doc: ExportDocument
  projectType: ProjectType
  manuscriptSettings: ManuscriptSettings
  coverFrontUrl?: string
  coverBackUrl?: string
}) {
  const [target, setTarget] = useState<{ chapterId: string; title: string; quote: string } | null>(null)

  return (
    <>
      <ReadView
        doc={doc}
        projectType={projectType}
        manuscriptSettings={manuscriptSettings}
        coverFrontUrl={coverFrontUrl}
        coverBackUrl={coverBackUrl}
        renderExtra={
          allowComments
            ? (current) => (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!current}
                  title={current ? "Select a passage first to quote it" : "Turn to a chapter to comment on it"}
                  // Read the selection before the click moves focus away from it.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    if (!current) return
                    const quote = window.getSelection()?.toString().trim() ?? ""
                    setTarget({ chapterId: current.chapterId, title: current.title, quote })
                  }}
                >
                  <ChatTeardropTextIcon />
                  Comment
                </Button>
              )
            : undefined
        }
      />
      {target ? <CommentDialog token={token} target={target} onClose={() => setTarget(null)} /> : null}
    </>
  )
}

function CommentDialog({
  token,
  target,
  onClose,
}: {
  token: string
  target: { chapterId: string; title: string; quote: string }
  onClose: () => void
}) {
  const [name, setName] = useState("")
  const [body, setBody] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  // Remember the reader's name between comments (this browser only).
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reading a browser-only value after mount
      setName(localStorage.getItem(NAME_KEY) ?? "")
    } catch {
      // Storage blocked: they'll type it each time.
    }
  }, [])

  async function send() {
    setBusy(true)
    setError(null)
    const result = await addReaderCommentAction(token, {
      chapterId: target.chapterId,
      name,
      body,
      quote: target.quote,
    }).catch(() => ({ ok: false as const, error: "Couldn't send your comment. Please try again." }))
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    try {
      localStorage.setItem(NAME_KEY, name.trim())
    } catch {
      // Not essential.
    }
    setSent(true)
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <div className="flex flex-col gap-1">
          <DialogTitle>Comment on {target.title}</DialogTitle>
          <DialogDescription>Only the writer sees your comments.</DialogDescription>
        </div>
        {sent ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-foreground">Thanks! Your comment was sent to the writer.</p>
            <Button className="w-fit" onClick={onClose}>
              Keep reading
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {target.quote ? (
              <p className="line-clamp-4 border-l-2 border-primary/50 pl-2 text-sm text-muted-foreground italic">
                {target.quote}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Tip: select a passage before pressing Comment to quote it.
              </p>
            )}
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              placeholder="Your name"
              aria-label="Your name"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            />
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={2000}
              rows={4}
              placeholder="What did you think?"
              aria-label="Your comment"
              className="resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            />
            {error ? (
              <p role="alert" className="text-xs text-destructive">
                {error}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={onClose} disabled={busy}>
                Cancel
              </Button>
              <Button onClick={send} disabled={busy || !name.trim() || !body.trim()}>
                {busy ? "Sending…" : "Send comment"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
