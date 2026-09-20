"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { TrashIcon } from "@phosphor-icons/react/dist/ssr"
import { Button } from "@/components/ui/button"
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog"
import { deleteNoteAction } from "../actions"

export function DeleteNoteButton({
  projectId,
  noteId,
  title,
}: {
  projectId: string
  noteId: string
  title: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)

  function handleConfirm() {
    startTransition(async () => {
      await deleteNoteAction(projectId, noteId)
      router.push(`/projects/${projectId}/notes`)
    })
  }

  return (
    <>
      <Button
        type="button"
        variant="destructive"
        size="sm"
        disabled={isPending}
        onClick={() => setOpen(true)}
      >
        <TrashIcon />
        Delete
      </Button>
      <DeleteConfirmDialog
        open={open}
        onOpenChange={setOpen}
        itemName={title}
        itemLabel="note"
        onConfirm={handleConfirm}
        pending={isPending}
      />
    </>
  )
}
