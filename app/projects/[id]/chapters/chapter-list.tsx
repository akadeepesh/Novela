"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import {
  PlusIcon,
  CaretUpIcon,
  CaretDownIcon,
  TrashIcon,
} from "@phosphor-icons/react/dist/ssr"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog"
import type { SerializedChapterSummary } from "@/lib/chapters"
import { createChapterAction, deleteChapterAction, moveChapterAction } from "./actions"

const STATUS_VARIANT: Record<SerializedChapterSummary["status"], { label: string }> = {
  draft: { label: "Draft" },
  "in-progress": { label: "In progress" },
  done: { label: "Done" },
}

export function ChapterList({
  projectId,
  chapters,
  label,
  singular,
}: {
  projectId: string
  chapters: SerializedChapterSummary[]
  label: string
  singular: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null)

  function handleConfirmDelete() {
    if (!deleteTarget) return
    startTransition(async () => {
      await deleteChapterAction(projectId, deleteTarget.id)
      setDeleteTarget(null)
      router.refresh()
    })
  }

  function handleMove(chapterId: string, direction: "up" | "down") {
    startTransition(async () => {
      await moveChapterAction(projectId, chapterId, direction)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {chapters.length} {chapters.length === 1 ? singular.toLowerCase() : label.toLowerCase()}
        </p>
        <form action={createChapterAction.bind(null, projectId)}>
          <Button type="submit" size="sm" disabled={isPending}>
            <PlusIcon />
            New {singular.toLowerCase()}
          </Button>
        </form>
      </div>

      <div className="flex flex-col gap-2">
        {chapters.map((chapter, index) => (
          <div
            key={chapter.id}
            className="group flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 transition-colors hover:border-primary/30"
          >
            <div className="flex flex-col">
              <button
                type="button"
                disabled={index === 0 || isPending}
                onClick={() => handleMove(chapter.id, "up")}
                className="text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
                aria-label="Move up"
              >
                <CaretUpIcon className="size-3.5" />
              </button>
              <button
                type="button"
                disabled={index === chapters.length - 1 || isPending}
                onClick={() => handleMove(chapter.id, "down")}
                className="text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
                aria-label="Move down"
              >
                <CaretDownIcon className="size-3.5" />
              </button>
            </div>

            <Link
              href={`/projects/${projectId}/chapters/${chapter.id}`}
              className="flex min-w-0 flex-1 items-center gap-3"
            >
              <span className="w-6 shrink-0 text-right text-xs text-muted-foreground">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                {chapter.title}
              </span>
              <Badge variant="secondary" className="shrink-0">
                {STATUS_VARIANT[chapter.status].label}
              </Badge>
              <span className="shrink-0 text-xs text-muted-foreground">
                {chapter.wordCount.toLocaleString()} words
              </span>
            </Link>

            <button
              type="button"
              disabled={isPending}
              onClick={() => setDeleteTarget({ id: chapter.id, title: chapter.title })}
              className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100 disabled:pointer-events-none"
              aria-label={`Delete ${chapter.title}`}
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
        itemLabel={singular.toLowerCase()}
        onConfirm={handleConfirmDelete}
        pending={isPending}
      />
    </div>
  )
}
