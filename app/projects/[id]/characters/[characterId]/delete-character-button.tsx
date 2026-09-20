"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { TrashIcon } from "@phosphor-icons/react/dist/ssr"
import { Button } from "@/components/ui/button"
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog"
import { deleteCharacterAction } from "../actions"

export function DeleteCharacterButton({
  projectId,
  characterId,
  name,
}: {
  projectId: string
  characterId: string
  name: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)

  function handleConfirm() {
    startTransition(async () => {
      await deleteCharacterAction(projectId, characterId)
      router.push(`/projects/${projectId}/characters`)
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
        itemLabel="character"
        onConfirm={handleConfirm}
        pending={isPending}
      />
    </>
  )
}
