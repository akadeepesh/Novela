"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { TrashIcon } from "@phosphor-icons/react/dist/ssr"
import { Button } from "@/components/ui/button"
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog"
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
  const [open, setOpen] = useState(false)

  function handleConfirm() {
    startTransition(async () => {
      await deleteResearchEntryAction(projectId, entryId)
      router.push(`/projects/${projectId}/research`)
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
        itemLabel="entry"
        onConfirm={handleConfirm}
        pending={isPending}
      />
    </>
  )
}
