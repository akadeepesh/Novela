"use client"

import Link from "next/link"
import { useState, useTransition } from "react"
import { TrashIcon, UserCircleIcon } from "@phosphor-icons/react/dist/ssr"
import { NewLinkButton } from "@/components/ui/new-link-button"
import { Badge } from "@/components/ui/badge"
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog"
import { characterRoleLabel } from "@/lib/character-config"
import type { SerializedCharacterSummary } from "@/lib/store/bible"
import { deleteCharacterAction } from "./actions"

export function CharacterGrid({
  projectId,
  characters,
}: {
  projectId: string
  characters: SerializedCharacterSummary[]
}) {
  const [isPending, startTransition] = useTransition()
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)

  function handleConfirmDelete() {
    if (!deleteTarget) return
    startTransition(async () => {
      await deleteCharacterAction(projectId, deleteTarget.id)
      setDeleteTarget(null)
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {characters.length} {characters.length === 1 ? "character" : "characters"}
        </p>
        <NewLinkButton href={`/projects/${projectId}/characters/new`}>New character</NewLinkButton>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {characters.map((character) => (
          <Card key={character.id} className="group relative h-full">
            <button
              type="button"
              disabled={isPending}
              onClick={() => setDeleteTarget({ id: character.id, name: character.name })}
              className="absolute top-4 right-4 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100 disabled:pointer-events-none"
              aria-label={`Delete ${character.name}`}
            >
              <TrashIcon className="size-4" />
            </button>

            <Link href={`/projects/${projectId}/characters/${character.id}`} className="block">
              <CardHeader className="items-center text-center">
                <div className="mb-2 flex size-16 items-center justify-center overflow-hidden rounded-full bg-muted text-muted-foreground">
                  {character.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={character.imageUrl}
                      alt={character.name}
                      className="size-full object-cover"
                    />
                  ) : (
                    <UserCircleIcon className="size-8" weight="duotone" />
                  )}
                </div>
                <CardTitle className="text-base">{character.name}</CardTitle>
                {character.appearance ? (
                  <CardDescription className="line-clamp-2">{character.appearance}</CardDescription>
                ) : (
                  <CardDescription className="italic">No description yet</CardDescription>
                )}
              </CardHeader>
              <CardFooter className="justify-center border-t pt-4">
                <Badge variant="secondary">{characterRoleLabel(character.role)}</Badge>
              </CardFooter>
            </Link>
          </Card>
        ))}
      </div>

      <DeleteConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        itemName={deleteTarget?.name ?? ""}
        itemLabel="character"
        onConfirm={handleConfirmDelete}
        pending={isPending}
      />
    </div>
  )
}
