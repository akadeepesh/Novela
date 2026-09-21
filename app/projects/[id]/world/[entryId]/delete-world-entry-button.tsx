"use client"

import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { TrashIcon } from "@phosphor-icons/react/dist/ssr"
import { Button } from "@/components/ui/button"
import { deleteWorldEntryAction } from "../actions"

export function DeleteWorldEntryButton({
  projectId,
  entryId,
  name,
}: {
  projectId: string
  entryId: string
  name: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    if (!window.confirm(`Delete "${name}"? This can't be undone.`)) return
    startTransition(async () => {
      await deleteWorldEntryAction(projectId, entryId)
      router.push(`/projects/${projectId}/world`)
    })
  }

  return (
    <Button type="button" variant="destructive" size="sm" disabled={isPending} onClick={handleDelete}>
      <TrashIcon />
      Delete
    </Button>
  )
}
