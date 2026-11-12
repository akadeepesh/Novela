"use client"

import Link from "next/link"
import { useMemo, useState, useTransition } from "react"
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  TrashIcon,
  BookOpenIcon,
  DotsSixVerticalIcon,
  RowsIcon,
  KanbanIcon,
  ArrowCounterClockwiseIcon,
} from "@phosphor-icons/react/dist/ssr"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { NewLinkButton } from "@/components/ui/new-link-button"
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog"
import type { SerializedChapterSummary, TrashedChapter } from "@/lib/store/chapters"
import type { ProjectType } from "@/lib/project-config"
import { estimateScriptRuntime } from "@/lib/script-scaffold"
import { createActionQueue } from "@/lib/action-queue"
import {
  CHAPTER_LABELS,
  CHAPTER_LABEL_COLOR,
  CHAPTER_STATUSES,
  CHAPTER_STATUS_LABEL,
  type ChapterLabel,
  type ChapterStatus,
} from "@/lib/chapter-config"
import {
  deleteChapterForeverAction,
  reorderChaptersAction,
  restoreChapterAction,
  trashChapterAction,
  updateChapterMetaAction,
  type ChapterMetaInput,
} from "./actions"

type View = "list" | "board"

export function ChapterList({
  projectId,
  chapters,
  trashed,
  label,
  singular,
  projectType,
  defaultView,
}: {
  projectId: string
  chapters: SerializedChapterSummary[]
  trashed: TrashedChapter[]
  label: string
  singular: string
  projectType: ProjectType
  defaultView: View
}) {
  const [isPending, startTransition] = useTransition()
  const [items, setItems] = useState(chapters)
  const [view, setView] = useState<View>(defaultView)
  const [notice, setNotice] = useState<string | null>(null)
  const [trashOpen, setTrashOpen] = useState(false)
  const [forgetTarget, setForgetTarget] = useState<TrashedChapter | null>(null)
  // Metadata edits go out one at a time, in order (see lib/action-queue.ts).
  const enqueue = useMemo(() => createActionQueue(), [])

  // Take the stored list whenever it changes (it updates live).
  const [prevChapters, setPrevChapters] = useState(chapters)
  if (chapters !== prevChapters) {
    setPrevChapters(chapters)
    setItems(chapters)
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function chooseView(next: View) {
    setView(next)
    // Remembered per browser; read back on the server for the first render.
    document.cookie = `chapters-view=${next}; path=/; max-age=31536000; samesite=lax`
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    const from = items.findIndex((c) => c.id === active.id)
    const to = items.findIndex((c) => c.id === over.id)
    const next = arrayMove(items, from, to)
    setItems(next)
    setNotice(null)
    void enqueue(() => reorderChaptersAction(projectId, next.map((c) => c.id))).then((result) => {
      if (!result.ok) {
        setNotice("Couldn't save the new order: the list changed in another tab. It's been reloaded.")
        setItems(chapters)
      }
    })
  }

  function updateMeta(chapterId: string, patch: ChapterMetaInput) {
    setItems((prev) => prev.map((c) => (c.id === chapterId ? { ...c, ...patch } : c)))
    void enqueue(() => updateChapterMetaAction(projectId, chapterId, patch)).then((result) => {
      if (!result.ok) setNotice("Couldn't save that change. Please try again.")
    })
  }

  function moveToTrash(chapter: SerializedChapterSummary) {
    setItems((prev) => prev.filter((c) => c.id !== chapter.id))
    startTransition(async () => {
      const result = await trashChapterAction(projectId, chapter.id)
      if (!result.ok) setNotice(`Couldn't move “${chapter.title}” to the Trash.`)
    })
  }

  function restore(chapter: TrashedChapter) {
    setNotice(null)
    startTransition(async () => {
      const result = await restoreChapterAction(projectId, chapter.id)
      if (!result.ok) setNotice(result.error)
    })
  }

  function deleteForever() {
    if (!forgetTarget) return
    const target = forgetTarget
    startTransition(async () => {
      const result = await deleteChapterForeverAction(projectId, target.id)
      setForgetTarget(null)
      if (!result.ok) setNotice(`Couldn't delete “${target.title}”.`)
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground">
            {items.length} {items.length === 1 ? singular.toLowerCase() : label.toLowerCase()}
          </p>
          <div role="radiogroup" aria-label="View" className="inline-flex rounded-md border border-border p-0.5">
            <ViewButton active={view === "list"} onClick={() => chooseView("list")} label="List">
              <RowsIcon />
            </ViewButton>
            <ViewButton active={view === "board"} onClick={() => chooseView("board")} label="Outline board">
              <KanbanIcon />
            </ViewButton>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {items.length > 0 ? (
            <Button size="sm" variant="outline" render={<Link href={`/read/${projectId}`} />} nativeButton={false}>
              <BookOpenIcon />
              Read book
            </Button>
          ) : null}
          <NewLinkButton href={`/projects/${projectId}/chapters/new`}>New {singular.toLowerCase()}</NewLinkButton>
        </div>
      </div>

      {notice ? (
        <p role="alert" className="text-sm text-destructive">
          {notice}
        </p>
      ) : null}

      {items.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          Drag to reorder{view === "board" ? ". Click a card's text to add a synopsis." : "."} Keyboard: focus a
          handle, press Space, then the arrow keys.
        </p>
      ) : null}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext
          items={items.map((c) => c.id)}
          strategy={view === "board" ? rectSortingStrategy : verticalListSortingStrategy}
        >
          {view === "board" ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((chapter, index) => (
                <BoardCard
                  key={chapter.id}
                  projectId={projectId}
                  chapter={chapter}
                  index={index}
                  onMeta={(patch) => updateMeta(chapter.id, patch)}
                  onTrash={() => moveToTrash(chapter)}
                  disabled={isPending}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {items.map((chapter, index) => (
                <ListRow
                  key={chapter.id}
                  projectId={projectId}
                  chapter={chapter}
                  index={index}
                  projectType={projectType}
                  onMeta={(patch) => updateMeta(chapter.id, patch)}
                  onTrash={() => moveToTrash(chapter)}
                  disabled={isPending}
                />
              ))}
            </div>
          )}
        </SortableContext>
      </DndContext>

      {trashed.length > 0 ? (
        <div className="mt-6 border-t border-border pt-4">
          <button
            type="button"
            onClick={() => setTrashOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            aria-expanded={trashOpen}
          >
            <TrashIcon className="size-4" />
            Trash ({trashed.length})
          </button>
          {trashOpen ? (
            <ul className="mt-3 flex flex-col gap-2">
              {trashed.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center gap-3 rounded-lg border border-dashed border-border px-3 py-2 text-sm"
                >
                  <span className="min-w-0 flex-1 truncate text-foreground">{t.title}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {t.wordCount.toLocaleString()} words · deleted for good in {t.daysLeft}{" "}
                    {t.daysLeft === 1 ? "day" : "days"}
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => restore(t)} disabled={isPending}>
                    <ArrowCounterClockwiseIcon />
                    Restore
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => setForgetTarget(t)}
                    disabled={isPending}
                  >
                    Delete forever
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <DeleteConfirmDialog
        open={forgetTarget !== null}
        onOpenChange={(open) => !open && setForgetTarget(null)}
        itemName={forgetTarget?.title ?? ""}
        itemLabel={singular.toLowerCase()}
        onConfirm={deleteForever}
        pending={isPending}
      />
    </div>
  )
}

function ViewButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean
  onClick: () => void
  label: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "inline-flex size-7 items-center justify-center rounded text-muted-foreground [&_svg]:size-4",
        active ? "bg-muted text-foreground" : "hover:text-foreground"
      )}
    >
      {children}
    </button>
  )
}

function useSortableItem(id: string) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id })
  return {
    setNodeRef,
    style: { transform: CSS.Transform.toString(transform), transition },
    isDragging,
    handleProps: { ref: setActivatorNodeRef, ...attributes, ...listeners },
  }
}

function DragHandle({ handleProps, title }: { handleProps: ReturnType<typeof useSortableItem>["handleProps"]; title: string }) {
  return (
    <button
      type="button"
      {...handleProps}
      aria-label={`Reorder ${title}`}
      className="shrink-0 cursor-grab touch-none rounded p-0.5 text-muted-foreground hover:text-foreground active:cursor-grabbing"
    >
      <DotsSixVerticalIcon className="size-4" weight="bold" />
    </button>
  )
}

function StatusSelect({
  value,
  onChange,
  title,
}: {
  value: ChapterStatus
  onChange: (status: ChapterStatus) => void
  title: string
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as ChapterStatus)}
      aria-label={`Status of ${title}`}
      className={cn(
        "shrink-0 cursor-pointer rounded-full border-0 px-2 py-0.5 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        value === "done"
          ? "bg-primary/15 text-primary"
          : value === "in-progress"
            ? "bg-secondary text-secondary-foreground"
            : "bg-muted text-muted-foreground"
      )}
    >
      {CHAPTER_STATUSES.map((s) => (
        <option key={s} value={s}>
          {CHAPTER_STATUS_LABEL[s]}
        </option>
      ))}
    </select>
  )
}

function LabelDot({ label }: { label: ChapterLabel }) {
  if (!label) return null
  return <span className="size-2.5 shrink-0 rounded-full" style={{ background: CHAPTER_LABEL_COLOR[label] }} aria-hidden />
}

function LabelPicker({ value, onChange }: { value: ChapterLabel; onChange: (label: ChapterLabel) => void }) {
  return (
    <div role="radiogroup" aria-label="Colour label" className="flex items-center gap-1">
      {CHAPTER_LABELS.map((l) => (
        <button
          key={l || "none"}
          type="button"
          role="radio"
          aria-checked={value === l}
          aria-label={l || "No label"}
          title={l || "No label"}
          onClick={() => onChange(l)}
          className={cn(
            "size-3.5 rounded-full border transition-transform hover:scale-110",
            value === l ? "ring-2 ring-ring ring-offset-1 ring-offset-card" : "",
            l ? "border-transparent" : "border-border bg-transparent"
          )}
          style={l ? { background: CHAPTER_LABEL_COLOR[l] } : undefined}
        />
      ))}
    </div>
  )
}

function ListRow({
  projectId,
  chapter,
  index,
  projectType,
  onMeta,
  onTrash,
  disabled,
}: {
  projectId: string
  chapter: SerializedChapterSummary
  index: number
  projectType: ProjectType
  onMeta: (patch: ChapterMetaInput) => void
  onTrash: () => void
  disabled: boolean
}) {
  const { setNodeRef, style, isDragging, handleProps } = useSortableItem(chapter.id)
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 transition-colors hover:border-primary/30",
        isDragging && "z-10 shadow-lg"
      )}
    >
      <DragHandle handleProps={handleProps} title={chapter.title} />
      <Link href={`/projects/${projectId}/chapters/${chapter.id}`} className="flex min-w-0 flex-1 items-center gap-3">
        <span className="w-6 shrink-0 text-right text-xs text-muted-foreground">{index + 1}</span>
        <LabelDot label={chapter.label} />
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{chapter.title}</span>
      </Link>
      <StatusSelect value={chapter.status} onChange={(status) => onMeta({ status })} title={chapter.title} />
      <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
        {chapter.wordCount.toLocaleString()} words
        {projectType === "script-writing" ? ` · ${estimateScriptRuntime(chapter.wordCount)}` : ""}
      </span>
      <button
        type="button"
        disabled={disabled}
        onClick={onTrash}
        className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100 disabled:pointer-events-none"
        aria-label={`Move ${chapter.title} to the Trash`}
        title="Move to Trash"
      >
        <TrashIcon className="size-4" />
      </button>
    </div>
  )
}

function BoardCard({
  projectId,
  chapter,
  index,
  onMeta,
  onTrash,
  disabled,
}: {
  projectId: string
  chapter: SerializedChapterSummary
  index: number
  onMeta: (patch: ChapterMetaInput) => void
  onTrash: () => void
  disabled: boolean
}) {
  const { setNodeRef, style, isDragging, handleProps } = useSortableItem(chapter.id)
  const [synopsis, setSynopsis] = useState(chapter.synopsis)
  const [prevSynopsis, setPrevSynopsis] = useState(chapter.synopsis)
  if (chapter.synopsis !== prevSynopsis) {
    setPrevSynopsis(chapter.synopsis)
    setSynopsis(chapter.synopsis)
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex min-h-44 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xs",
        isDragging && "z-10 shadow-lg"
      )}
    >
      <div
        className="h-1.5 w-full"
        style={{ background: chapter.label ? CHAPTER_LABEL_COLOR[chapter.label] : "transparent" }}
      />
      <div className="flex items-start gap-2 px-3 pt-2.5">
        <DragHandle handleProps={handleProps} title={chapter.title} />
        <Link href={`/projects/${projectId}/chapters/${chapter.id}`} className="min-w-0 flex-1">
          <span className="text-[11px] text-muted-foreground">{index + 1}</span>
          <p className="truncate text-sm font-semibold text-foreground hover:underline">{chapter.title}</p>
        </Link>
        <button
          type="button"
          disabled={disabled}
          onClick={onTrash}
          className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100"
          aria-label={`Move ${chapter.title} to the Trash`}
          title="Move to Trash"
        >
          <TrashIcon className="size-4" />
        </button>
      </div>
      <textarea
        value={synopsis}
        maxLength={1000}
        onChange={(e) => setSynopsis(e.target.value)}
        onBlur={() => {
          if (synopsis.trim() !== chapter.synopsis) onMeta({ synopsis: synopsis.trim() })
        }}
        placeholder="What happens here…"
        aria-label={`Synopsis of ${chapter.title}`}
        rows={3}
        className="mx-3 mt-1.5 flex-1 resize-none bg-transparent text-[13px] leading-snug text-foreground outline-none placeholder:text-muted-foreground/70"
      />
      <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2">
        <LabelPicker value={chapter.label} onChange={(label) => onMeta({ label })} />
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground">{chapter.wordCount.toLocaleString()} w</span>
          <StatusSelect value={chapter.status} onChange={(status) => onMeta({ status })} title={chapter.title} />
        </div>
      </div>
    </div>
  )
}
