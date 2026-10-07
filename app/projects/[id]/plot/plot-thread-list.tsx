"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { TrashIcon } from "@phosphor-icons/react/dist/ssr"
import { NewLinkButton } from "@/components/ui/new-link-button"
import { Badge, type badgeVariants } from "@/components/ui/badge"
import type { VariantProps } from "class-variance-authority"
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog"
import { plotStatusLabel } from "@/lib/plot-config"
import type { SerializedPlotThreadSummary } from "@/lib/plot-threads"
import { deletePlotThreadAction } from "./actions"

type BadgeVariant = VariantProps<typeof badgeVariants>["variant"]

const STATUS_VARIANT: Record<SerializedPlotThreadSummary["status"], BadgeVariant> = {
  planned: "outline",
  active: "default",
  resolved: "secondary",
  abandoned: "outline",
}

export function PlotThreadList({
  projectId,
  threads,
}: {
  projectId: string
  threads: SerializedPlotThreadSummary[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null)

  function handleConfirmDelete() {
    if (!deleteTarget) return
    startTransition(async () => {
      await deletePlotThreadAction(projectId, deleteTarget.id)
      setDeleteTarget(null)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {threads.length} {threads.length === 1 ? "thread" : "threads"}
        </p>
        <NewLinkButton href={`/projects/${projectId}/plot/new`}>New thread</NewLinkButton>
      </div>

      <div className="flex flex-col gap-2">
        {threads.map((thread) => (
          <div
            key={thread.id}
            className="group flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 transition-colors hover:border-primary/30"
          >
            <Link
              href={`/projects/${projectId}/plot/${thread.id}`}
              className="flex min-w-0 flex-1 items-center gap-3"
            >
              <span
                className={
                  thread.status === "abandoned"
                    ? "min-w-0 flex-1 truncate text-sm font-medium text-muted-foreground line-through"
                    : "min-w-0 flex-1 truncate text-sm font-medium text-foreground"
                }
              >
                {thread.title}
              </span>
              {thread.description ? (
                <span className="hidden max-w-xs shrink truncate text-xs text-muted-foreground sm:inline">
                  {thread.description}
                </span>
              ) : null}
              <Badge variant={STATUS_VARIANT[thread.status]} className="shrink-0">
                {plotStatusLabel(thread.status)}
              </Badge>
            </Link>

            <button
              type="button"
              disabled={isPending}
              onClick={() => setDeleteTarget({ id: thread.id, title: thread.title })}
              className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100 disabled:pointer-events-none"
              aria-label={`Delete ${thread.title}`}
            >
              <TrashIcon className="size-4" />
            </button>
          </div>
        ))}
      </div>

      <DeleteConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        itemName={deleteTarget?.title ?? ""}
        itemLabel="thread"
        onConfirm={handleConfirmDelete}
        pending={isPending}
      />
    </div>
  )
}
