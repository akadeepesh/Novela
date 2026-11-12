"use client"

import Link from "next/link"
import { useState, useTransition } from "react"
import { TrashIcon } from "@phosphor-icons/react/dist/ssr"
import { NewLinkButton } from "@/components/ui/new-link-button"
import { Badge } from "@/components/ui/badge"
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog"
import { worldEntryTypeLabel, worldEntryTypeIcon } from "@/lib/world-config"
import type { SerializedWorldEntrySummary } from "@/lib/store/bible"
import { deleteWorldEntryAction } from "./actions"

export function WorldEntryGrid({
  projectId,
  entries,
}: {
  projectId: string
  entries: SerializedWorldEntrySummary[]
}) {
  const [isPending, startTransition] = useTransition()
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)

  function handleConfirmDelete() {
    if (!deleteTarget) return
    startTransition(async () => {
      await deleteWorldEntryAction(projectId, deleteTarget.id)
      setDeleteTarget(null)
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {entries.length} {entries.length === 1 ? "entry" : "entries"}
        </p>
        <NewLinkButton href={`/projects/${projectId}/world/new`}>New entry</NewLinkButton>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {entries.map((entry) => {
          const TypeIcon = worldEntryTypeIcon(entry.type)
          return (
            <Card key={entry.id} className="group relative h-full">
              <button
                type="button"
                disabled={isPending}
                onClick={() => setDeleteTarget({ id: entry.id, name: entry.name })}
                className="absolute top-4 right-4 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100 disabled:pointer-events-none"
                aria-label={`Delete ${entry.name}`}
              >
                <TrashIcon className="size-4" />
              </button>

              <Link href={`/projects/${projectId}/world/${entry.id}`} className="block">
                <CardHeader className="items-center text-center">
                  <div className="mb-2 flex size-16 items-center justify-center overflow-hidden rounded-lg bg-muted text-muted-foreground">
                    {entry.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={entry.imageUrl}
                        alt={entry.name}
                        className="size-full object-cover"
                      />
                    ) : (
                      <TypeIcon className="size-7" weight="duotone" />
                    )}
                  </div>
                  <CardTitle className="text-base">{entry.name}</CardTitle>
                  {entry.description ? (
                    <CardDescription className="line-clamp-2">{entry.description}</CardDescription>
                  ) : (
                    <CardDescription className="italic">No description yet</CardDescription>
                  )}
                </CardHeader>
                <CardFooter className="justify-center border-t pt-4">
                  <Badge variant="secondary">{worldEntryTypeLabel(entry.type)}</Badge>
                </CardFooter>
              </Link>
            </Card>
          )
        })}
      </div>

      <DeleteConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        itemName={deleteTarget?.name ?? ""}
        itemLabel="entry"
        onConfirm={handleConfirmDelete}
        pending={isPending}
      />
    </div>
  )
}
