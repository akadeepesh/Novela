"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { TrashIcon } from "@phosphor-icons/react/dist/ssr"
import { Button } from "@/components/ui/button"
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog"
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
  const [open, setOpen] = useState(false)

  function handleConfirm() {
    startTransition(async () => {
      await deletePlotThreadAction(projectId, threadId)
      router.push(`/projects/${projectId}/plot`)
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
        itemLabel="thread"
        onConfirm={handleConfirm}
        pending={isPending}
      />
    </>
  )
}
