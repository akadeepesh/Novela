"use client"

import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { TrashIcon } from "@phosphor-icons/react/dist/ssr"
import { Button } from "@/components/ui/button"
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

  function handleDelete() {
    if (!window.confirm(`Delete "${title}"? This can't be undone.`)) return
    startTransition(async () => {
      await deleteNoteAction(projectId, noteId)
      router.push(`/projects/${projectId}/notes`)
    })
  }

  return (
    <Button type="button" variant="destructive" size="sm" disabled={isPending} onClick={handleDelete}>
      <TrashIcon />
      Delete
    </Button>
  )
}
