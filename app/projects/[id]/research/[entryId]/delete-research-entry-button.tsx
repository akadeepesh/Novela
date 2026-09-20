"use client"

import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { TrashIcon } from "@phosphor-icons/react/dist/ssr"
import { Button } from "@/components/ui/button"
import { deleteResearchEntryAction } from "../actions"

export function DeleteResearchEntryButton({
  projectId,
  entryId,
  title,
}: {
  projectId: string
  entryId: string
  title: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    if (!window.confirm(`Delete "${title}"? This can't be undone.`)) return
    startTransition(async () => {
      await deleteResearchEntryAction(projectId, entryId)
      router.push(`/projects/${projectId}/research`)
    })
  }

  return (
    <Button type="button" variant="destructive" size="sm" disabled={isPending} onClick={handleDelete}>
      <TrashIcon />
      Delete
    </Button>
  )
}
