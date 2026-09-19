"use client"

import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { TrashIcon } from "@phosphor-icons/react/dist/ssr"
import { Button } from "@/components/ui/button"
import { deletePlotThreadAction } from "../actions"

export function DeletePlotThreadButton({
  projectId,
  threadId,
  title,
}: {
  projectId: string
  threadId: string
  title: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    if (!window.confirm(`Delete "${title}"? This can't be undone.`)) return
    startTransition(async () => {
      await deletePlotThreadAction(projectId, threadId)
      router.push(`/projects/${projectId}/plot`)
    })
  }

  return (
    <Button type="button" variant="destructive" size="sm" disabled={isPending} onClick={handleDelete}>
      <TrashIcon />
      Delete
    </Button>
  )
}
