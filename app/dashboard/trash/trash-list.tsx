"use client"

import { useState, useTransition } from "react"
import { ArrowCounterClockwiseIcon, TrashIcon } from "@phosphor-icons/react/dist/ssr"
import { Button } from "@/components/ui/button"
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog"
import { PROJECT_TYPE_ICON } from "@/lib/project-config"
import { relativeTime } from "@/lib/format"
import type { TrashedProject } from "@/lib/store/projects"
import { useTrashedProjects } from "@/lib/store/hooks"
import { restoreProjectAction, deleteProjectForeverAction, type TrashResult } from "./actions"

export function TrashList() {
  const items = useTrashedProjects()
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<TrashedProject | null>(null)
  const [isPending, startTransition] = useTransition()

  function run(action: (id: string) => Promise<TrashResult>, id: string, after?: () => void) {
    setError(null)
    startTransition(async () => {
      const result = await action(id)
      if (!result?.ok) setError(result?.error ?? "Something went wrong. Try again.")
      after?.()
    })
  }

  if (items === undefined) return null
  if (items.length === 0) return <p className="text-sm text-muted-foreground">The Trash is empty.</p>

  return (
    <div className="flex flex-col gap-2">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {items.map((item) => {
        const TypeIcon = PROJECT_TYPE_ICON[item.type]
        return (
          <div
            key={item.id}
            className="flex items-center gap-3 rounded-lg border border-border px-4 py-3"
          >
            <TypeIcon className="size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
              <p className="text-xs text-muted-foreground">
                Moved to Trash {relativeTime(item.deletedAt)} ·{" "}
                {item.daysLeft === 1 ? "1 day left" : `${item.daysLeft} days left`}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => run(restoreProjectAction, item.id)}
            >
              <ArrowCounterClockwiseIcon />
              Restore
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={isPending}
              onClick={() => setConfirming(item)}
              aria-label={`Delete ${item.title} forever`}
            >
              <TrashIcon />
              Delete forever
            </Button>
          </div>
        )
      })}

      <DeleteConfirmDialog
        open={confirming !== null}
        onOpenChange={(open) => {
          if (!open) setConfirming(null)
        }}
        itemName={confirming?.title ?? ""}
        itemLabel="project"
        title="Delete forever?"
        confirmLabel="Delete forever"
        description={
          <>
            This permanently deletes &ldquo;{confirming?.title}&rdquo; and everything in it — every
            chapter, character, note, research entry and version. This can&apos;t be undone.
          </>
        }
        onConfirm={() => confirming && run(deleteProjectForeverAction, confirming.id, () => setConfirming(null))}
        pending={isPending}
      />
    </div>
  )
}
