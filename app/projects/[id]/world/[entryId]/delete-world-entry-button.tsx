"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { TrashIcon } from "@phosphor-icons/react/dist/ssr"
import { Button } from "@/components/ui/button"
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog"
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
  const [open, setOpen] = useState(false)

  function handleConfirm() {
    startTransition(async () => {
      await deleteWorldEntryAction(projectId, entryId)
      router.push(`/projects/${projectId}/world`)
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
        itemName={name}
        itemLabel="entry"
        onConfirm={handleConfirm}
        pending={isPending}
      />
    </>
  )
}
