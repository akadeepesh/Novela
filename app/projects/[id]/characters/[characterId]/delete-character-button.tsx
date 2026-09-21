"use client"

import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { TrashIcon } from "@phosphor-icons/react/dist/ssr"
import { Button } from "@/components/ui/button"
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

  function handleDelete() {
    if (!window.confirm(`Delete "${name}"? This can't be undone.`)) return
    startTransition(async () => {
      await deleteCharacterAction(projectId, characterId)
      router.push(`/projects/${projectId}/characters`)
    })
  }

  return (
    <Button type="button" variant="destructive" size="sm" disabled={isPending} onClick={handleDelete}>
      <TrashIcon />
      Delete
    </Button>
  )
}
