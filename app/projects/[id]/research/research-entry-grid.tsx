"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { ArrowSquareOutIcon, PlusIcon, TrashIcon } from "@phosphor-icons/react/dist/ssr"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog"
import { researchEntryTypeLabel, researchEntryTypeIcon } from "@/lib/research-config"
import type { SerializedResearchEntrySummary } from "@/lib/research-entries"
import { createResearchEntryAction, deleteResearchEntryAction } from "./actions"

export function ResearchEntryGrid({
  projectId,
  entries,
}: {
  projectId: string
  entries: SerializedResearchEntrySummary[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null)

  function handleConfirmDelete() {
    if (!deleteTarget) return
    startTransition(async () => {
      await deleteResearchEntryAction(projectId, deleteTarget.id)
      setDeleteTarget(null)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {entries.length} {entries.length === 1 ? "entry" : "entries"}
        </p>
        <form action={createResearchEntryAction.bind(null, projectId)}>
          <Button type="submit" size="sm" disabled={isPending}>
            <PlusIcon />
            New entry
          </Button>
        </form>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {entries.map((entry) => {
          const TypeIcon = researchEntryTypeIcon(entry.type)
          const canVisit = entry.type !== "note" && Boolean(entry.url)

          return (
            <Card key={entry.id} className="group relative h-full">
              <div className="absolute top-4 right-4 flex items-center gap-2">
                {canVisit ? (
                  <a
                    href={entry.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground opacity-0 transition-opacity hover:text-primary group-hover:opacity-100"
                    aria-label={`Open ${entry.title} in a new tab`}
                  >
                    <ArrowSquareOutIcon className="size-4" />
                  </a>
                ) : null}
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => setDeleteTarget({ id: entry.id, title: entry.title })}
                  className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100 disabled:pointer-events-none"
                  aria-label={`Delete ${entry.title}`}
                >
                  <TrashIcon className="size-4" />
                </button>
              </div>

              <Link href={`/projects/${projectId}/research/${entry.id}`} className="block">
                <CardHeader>
                  {entry.type === "image" && entry.url ? (
                    <div className="mb-2 aspect-video w-full overflow-hidden rounded-md bg-muted">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={entry.url} alt={entry.title} className="size-full object-cover" />
                    </div>
                  ) : (
                    <TypeIcon className="mb-1 size-6 text-muted-foreground" weight="duotone" />
                  )}
                  <CardTitle className="pr-14 text-base">{entry.title}</CardTitle>
                  {entry.content ? (
                    <CardDescription className="line-clamp-2">{entry.content}</CardDescription>
                  ) : entry.url ? (
                    <CardDescription className="truncate">{entry.url}</CardDescription>
                  ) : (
                    <CardDescription className="italic">Empty</CardDescription>
                  )}
                </CardHeader>
                <CardFooter className="border-t pt-4">
                  <Badge variant="secondary">{researchEntryTypeLabel(entry.type)}</Badge>
                </CardFooter>
              </Link>
            </Card>
          )
        })}
      </div>

      <DeleteConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        itemName={deleteTarget?.title ?? ""}
        itemLabel="entry"
        onConfirm={handleConfirmDelete}
        pending={isPending}
      />
    </div>
  )
}
