"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { PlusIcon, PushPinIcon, TrashIcon } from "@phosphor-icons/react/dist/ssr"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog"
import type { SerializedNoteSummary } from "@/lib/notes"
import { createNoteAction, deleteNoteAction, togglePinNoteAction } from "./actions"

export function NoteGrid({
  projectId,
  notes,
}: {
  projectId: string
  notes: SerializedNoteSummary[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null)

  function handleConfirmDelete() {
    if (!deleteTarget) return
    startTransition(async () => {
      await deleteNoteAction(projectId, deleteTarget.id)
      setDeleteTarget(null)
      router.refresh()
    })
  }

  function handleTogglePin(noteId: string, pinned: boolean) {
    startTransition(async () => {
      await togglePinNoteAction(projectId, noteId, !pinned)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {notes.length} {notes.length === 1 ? "note" : "notes"}
        </p>
        <form action={createNoteAction.bind(null, projectId)}>
          <Button type="submit" size="sm" disabled={isPending}>
            <PlusIcon />
            New note
          </Button>
        </form>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {notes.map((note) => (
          <Card key={note.id} className="group relative h-full">
            <div className="absolute top-4 right-4 flex items-center gap-2">
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleTogglePin(note.id, note.pinned)}
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
                disabled={isPending}
                onClick={() => setDeleteTarget({ id: note.id, title: note.title })}
                className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100 disabled:pointer-events-none"
                aria-label={`Delete ${note.title}`}
              >
                <TrashIcon className="size-4" />
              </button>
            </div>

            <Link href={`/projects/${projectId}/notes/${note.id}`} className="block">
              <CardHeader>
                <CardTitle className="pr-14 text-base">{note.title}</CardTitle>
                {note.content ? (
                  <CardDescription className="line-clamp-4 whitespace-pre-line">
                    {note.content}
                  </CardDescription>
                ) : (
                  <CardDescription className="italic">Empty</CardDescription>
                )}
              </CardHeader>
              {note.tags.length > 0 ? (
                <CardFooter className="flex-wrap gap-1.5 border-t pt-4">
                  {note.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </CardFooter>
              ) : null}
            </Link>
          </Card>
        ))}
      </div>

      <DeleteConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        itemName={deleteTarget?.title ?? ""}
        itemLabel="note"
        onConfirm={handleConfirmDelete}
        pending={isPending}
      />
    </div>
  )
}
