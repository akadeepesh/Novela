"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowUUpLeftIcon,
  ArrowUUpRightIcon,
  BookOpenTextIcon,
  CheckCircleIcon,
  ImageSquareIcon,
  PaintBrushIcon,
  WarningIcon,
} from "@phosphor-icons/react/dist/ssr"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import {
  applyAction,
  redo as redoHistory,
  startHistory,
  undo as undoHistory,
  type History,
  type ReviewAction,
} from "@/lib/import/review/state"
import { needsLook, type BackgroundInfo, type ReviewState } from "@/lib/import/review/types"
import { pieceNoun } from "@/lib/import/pipeline/types"
import type { ProjectType } from "@/lib/project-config"
import { commitImportAction } from "../../actions"
import { saveReviewAction } from "./actions"
import { CoverPanel, DesignPanel, PiecePanel } from "./inspector"
import { PieceList } from "./piece-list"
import type { SheetBackground } from "./page-sheet"

type Tab = "piece" | "design" | "cover"
type Save = "saved" | "dirty" | "saving" | "error"

export function ReviewScreen({
  jobId,
  fileName,
  projectType,
  hasCoverAnswer,
  initial,
  background,
  hasCover,
  assetVersion,
  steps,
}: {
  jobId: string
  fileName: string
  projectType: ProjectType
  hasCoverAnswer: boolean
  initial: ReviewState
  background: BackgroundInfo | null
  hasCover: boolean
  assetVersion: number
  steps: React.ReactNode
}) {
  const router = useRouter()
  const reduceMotion = useReducedMotion()
  const [history, setHistory] = useState<History>(() => startHistory(initial))
  const state = history.present
  const [selectedId, setSelectedId] = useState(() => (initial.pieces.find(needsLook) ?? initial.pieces[0]).id)
  const [tab, setTab] = useState<Tab>("piece")
  const [filter, setFilter] = useState<"all" | "look">("all")
  const [notice, setNotice] = useState<string | null>(null)
  const [save, setSave] = useState<Save>("saved")
  const [bgVersion, setBgVersion] = useState(assetVersion)
  const [touchedUp, setTouchedUp] = useState(background?.touchedUp ?? false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const inspectorRef = useRef<HTMLDivElement>(null)

  const noun = pieceNoun(projectType, 1)
  const nouns = pieceNoun(projectType, 2)

  const dispatch = useCallback((action: ReviewAction) => {
    setHistory((h) => {
      const next = applyAction(h, action)
      return next
    })
    const message: Partial<Record<ReviewAction["type"], string>> = {
      merge: `Joined into one ${noun}.`,
      split: `Split into two ${nouns}.`,
      remove: `Left out of the import.`,
    }
    setNotice(message[action.type] ?? null)
  }, [noun, nouns])

  const undo = useCallback(() => {
    setHistory(undoHistory)
    setNotice(null)
  }, [])
  const redo = useCallback(() => {
    setHistory(redoHistory)
    setNotice(null)
  }, [])

  // If the selected piece was merged away or removed, land on a neighbour instead of nothing.
  useEffect(() => {
    if (state.pieces.some((p) => p.id === selectedId)) return
    setSelectedId(state.pieces[0].id)
  }, [state.pieces, selectedId])

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(null), 6000)
    return () => clearTimeout(t)
  }, [notice])

  // The accent shifts to the book's type, as on the other import screens.
  useEffect(() => {
    document.documentElement.setAttribute("data-genre", projectType)
    return () => document.documentElement.removeAttribute("data-genre")
  }, [projectType])

  // Autosave: a moment after the last change, the working copy goes to the server.
  const firstRun = useRef(true)
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false
      return
    }
    setSave("dirty")
    const t = setTimeout(async () => {
      setSave("saving")
      const res = await saveReviewAction(jobId, history.present)
      setSave(res.ok ? "saved" : "error")
    }, 800)
    return () => clearTimeout(t)
  }, [history.present, jobId])

  useEffect(() => {
    if (save === "saved") return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [save])

  // Ctrl/Cmd+Z to undo, with Shift to redo — unless the person is typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z") return
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return
      e.preventDefault()
      if (e.shiftKey) redo()
      else undo()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [undo, redo])

  const toCheck = state.pieces.filter(needsLook)
  const visible = filter === "look" ? toCheck : state.pieces
  const selectedIndex = Math.max(0, state.pieces.findIndex((p) => p.id === selectedId))
  const selected = state.pieces[selectedIndex]
  const words = useMemo(() => state.pieces.reduce((n, p) => n + p.wordCount, 0), [state.pieces])

  const dark = background?.flatColor.dark ?? false
  const sheet: SheetBackground =
    state.background.kind === "image" && background?.hasImage
      ? { kind: "image", url: `/api/import/${jobId}/asset/background?v=${bgVersion}`, dark }
      : { kind: "preset", id: state.background.kind === "preset" ? state.background.id : "cream" }

  function select(id: string) {
    setSelectedId(id)
    if (tab !== "piece") setTab("piece")
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches) {
      requestAnimationFrame(() => inspectorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }))
    }
  }

  async function create() {
    setCreating(true)
    setCreateError(null)
    // Make sure the server has exactly what's on screen before it builds the book from it.
    const saved = await saveReviewAction(jobId, history.present)
    if (!saved.ok) {
      setCreating(false)
      return setCreateError(saved.error)
    }
    setSave("saved")
    const result = await commitImportAction(jobId)
    if (!result.ok) {
      setCreating(false)
      return setCreateError(result.error)
    }
    router.push(result.next)
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "piece", label: `This ${noun}`, icon: <BookOpenTextIcon className="size-4" weight="duotone" /> },
    { id: "design", label: "Page design", icon: <PaintBrushIcon className="size-4" weight="duotone" /> },
    { id: "cover", label: "Cover", icon: <ImageSquareIcon className="size-4" weight="duotone" /> },
  ]

  return (
    <div className="flex min-h-screen flex-col bg-manuscript-bg text-manuscript-fg">
      <div className="flex items-center justify-between px-6 pt-6">
        <Link
          href={`/projects/import/${jobId}`}
          className="inline-flex items-center gap-1 text-sm opacity-60 transition-opacity outline-none hover:opacity-100 focus-visible:underline"
        >
          <ArrowLeftIcon className="size-3.5" />
          Back
        </Link>
      </div>

      <div className="flex flex-col items-center gap-5 px-6 pt-2 pb-6 text-center">
        {steps}
        <div className="flex w-full max-w-xl flex-col items-center gap-1.5">
          <input
            key={state.bookTitle}
            defaultValue={state.bookTitle}
            aria-label="Book title"
            onBlur={(e) => {
              const v = e.currentTarget.value.trim()
              if (v && v !== state.bookTitle) dispatch({ type: "bookTitle", title: v })
              else e.currentTarget.value = state.bookTitle
            }}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            className="w-full rounded-lg bg-transparent px-3 py-1 text-center font-serif text-3xl font-medium outline-none transition-colors hover:bg-current/5 focus:bg-background focus:ring-2 focus:ring-ring/60 sm:text-4xl"
          />
          <p className="text-sm opacity-60">
            {state.pieces.length.toLocaleString("en-US")} {pieceNoun(projectType, state.pieces.length)} · {words.toLocaleString("en-US")} words · from {fileName || "your PDF"}
          </p>
        </div>
      </div>

      {/* toolbar */}
      <div className="sticky top-0 z-30 border-y border-current/10 bg-manuscript-bg/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-6 py-3">
          <div role="tablist" aria-label="Which pieces to show" className="flex rounded-full border border-current/15 p-0.5 text-sm">
            {(
              [
                ["all", `All ${state.pieces.length}`],
                ["look", toCheck.length ? `Worth a look · ${toCheck.length}` : "Worth a look"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={filter === id}
                onClick={() => setFilter(id)}
                className={cn(
                  "rounded-full px-3.5 py-1 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  filter === id ? "bg-primary text-primary-foreground" : "opacity-70 hover:opacity-100"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" onClick={undo} disabled={history.past.length === 0} aria-label="Undo">
              <ArrowUUpLeftIcon />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={redo} disabled={history.future.length === 0} aria-label="Redo">
              <ArrowUUpRightIcon />
            </Button>
          </div>

          <div className="min-h-5 flex-1 text-sm" role="status" aria-live="polite">
            <AnimatePresence mode="wait" initial={false}>
              {notice ? (
                <motion.p key="notice" initial={reduceMotion ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-2">
                  {notice}
                  <button type="button" onClick={undo} className="font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:underline">
                    Undo
                  </button>
                </motion.p>
              ) : (
                <motion.p key="save" initial={false} animate={{ opacity: 0.5 }} className="text-xs">
                  {save === "saved" ? "All changes saved" : save === "saving" ? "Saving…" : save === "dirty" ? "Unsaved changes…" : "Couldn’t save — we’ll keep trying"}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          <div className="flex items-center gap-3">
            {toCheck.length > 0 ? (
              <span className="hidden text-xs opacity-60 sm:inline">
                {toCheck.length} still to look at — you can also fix them later
              </span>
            ) : (
              <span className="hidden items-center gap-1 text-xs text-primary sm:inline-flex">
                <CheckCircleIcon className="size-3.5" weight="fill" />
                Everything checked
              </span>
            )}
            <Button size="lg" onClick={create} disabled={creating}>
              {creating ? "Creating your book…" : "Create my book"}
              {creating ? null : <ArrowRightIcon />}
            </Button>
          </div>
        </div>
        {createError ? (
          <p role="alert" className="mx-auto max-w-6xl px-6 pb-3 text-right text-sm text-destructive">
            {createError}
          </p>
        ) : null}
      </div>

      <div className="mx-auto grid w-full max-w-6xl flex-1 items-start gap-10 px-6 py-8 pb-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        {/* the list */}
        <section aria-label={`Your ${nouns}`}>
          {visible.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-current/20 p-10 text-center">
              <CheckCircleIcon className="size-8 text-primary" weight="duotone" />
              <p className="font-serif text-xl">Everything’s been looked at</p>
              <p className="max-w-xs text-sm leading-relaxed opacity-65">Nothing else was flagged. Switch back to all {nouns} to read through them, or create your book.</p>
              <Button variant="outline" onClick={() => setFilter("all")}>
                Show all {nouns}
              </Button>
            </div>
          ) : (
            <PieceList pieces={visible} selectedId={selectedId} onSelect={select} dispatch={dispatch} reorderable={filter === "all"} noun={noun} />
          )}
        </section>

        {/* the inspector */}
        <aside ref={inspectorRef} className="flex flex-col gap-5 scroll-mt-24 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:pr-1">
          <div role="tablist" aria-label="What to look at" className="flex rounded-full border border-current/15 p-0.5 text-sm">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  tab === t.id ? "bg-primary text-primary-foreground" : "opacity-70 hover:opacity-100"
                )}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>

          {tab === "piece" ? (
            <PiecePanel
              piece={selected}
              index={selectedIndex}
              total={state.pieces.length}
              prevId={selectedIndex > 0 ? state.pieces[selectedIndex - 1].id : null}
              sheet={sheet}
              dispatch={dispatch}
              noun={noun}
            />
          ) : null}
          {tab === "design" ? (
            <DesignPanel
              jobId={jobId}
              info={background ? { ...background, touchedUp } : null}
              choice={state.background}
              version={bgVersion}
              sample={selected}
              dispatch={dispatch}
              onTouchedUp={() => {
                setTouchedUp(true)
                setBgVersion(Date.now())
              }}
            />
          ) : null}
          {tab === "cover" ? (
            <CoverPanel jobId={jobId} hasCover={hasCover} useCover={state.useCover} hadCoverAnswer={hasCoverAnswer} dispatch={dispatch} />
          ) : null}

          {toCheck.length > 0 && tab === "piece" && !needsLook(selected) ? (
            <button
              type="button"
              onClick={() => select(toCheck[0].id)}
              className="inline-flex items-center gap-2 self-start rounded-full border border-amber-500/35 bg-amber-500/10 px-3.5 py-1.5 text-sm text-amber-700 outline-none transition-colors hover:bg-amber-500/15 focus-visible:ring-2 focus-visible:ring-ring dark:text-amber-300"
            >
              <WarningIcon className="size-4" weight="fill" />
              Next one worth a look
            </button>
          ) : null}
        </aside>
      </div>
    </div>
  )
}
