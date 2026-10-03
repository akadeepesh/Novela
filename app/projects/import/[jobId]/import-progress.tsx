"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import {
  ArrowClockwiseIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  FilePdfIcon,
  FileTextIcon,
  ImageSquareIcon,
  MagnifyingGlassIcon,
  MinusIcon,
  PaintBrushIcon,
  TextAlignCenterIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react/dist/ssr"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import type { SerializedImportJob } from "@/lib/import/jobs"
import {
  STAGE_ORDER,
  freshRun,
  pieceNoun,
  type ImportAssets,
  type ImportSummary,
  type RunState,
  type StageId,
} from "@/lib/import/pipeline/types"
import { projectTypeLabel, type ProjectType } from "@/lib/project-config"
import { discardImportAction, startImportAction } from "../actions"
import { LivingPage } from "./living-page"

const STAGE_ICON: Record<StageId, React.ComponentType<{ className?: string; weight?: "duotone" | "fill" | "bold" }>> = {
  text: FileTextIcon,
  structure: MagnifyingGlassIcon,
  format: TextAlignCenterIcon,
  background: PaintBrushIcon,
  cover: ImageSquareIcon,
}

function stageTitle(id: StageId, type: ProjectType): string {
  const noun = pieceNoun(type, 1)
  switch (id) {
    case "text":
      return "Reading the text"
    case "structure":
      return `Finding where each ${noun} begins`
    case "format":
      return type === "poetry" ? "Setting the lines and stanzas" : "Setting the paragraphs"
    case "background":
      return "Lifting the page design"
    case "cover":
      return "Building the cover"
  }
}

// The background is the slow stage, so it gets a little company: what's really
// going on, in plain words, changing every few seconds.
const BACKGROUND_LINES = [
  "Every page is drawn, then laid over the others.",
  "What’s the same on every page stays. The writing drifts away.",
  "Frames, flowers and flourishes are the last things to fade.",
  "Nearly there — just tidying the page numbers.",
]

type Snapshot = { run: RunState | null; summary: ImportSummary | null; assets: ImportAssets }

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [active])
  return now
}

const clock = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
}

export function ImportProgress({ job, steps }: { job: SerializedImportJob; steps: React.ReactNode }) {
  const router = useRouter()
  const reduceMotion = useReducedMotion()
  const type = job.projectType ?? "custom"

  const [snap, setSnap] = useState<Snapshot>({
    run: job.run ?? null,
    summary: job.summary ?? null,
    assets: job.assets ?? { background: false, cover: false },
  })
  const [offline, setOffline] = useState(false)
  const [gone, setGone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [leaving, startLeave] = useTransition()
  const [retrying, startRetry] = useTransition()

  const phase = snap.run?.phase ?? "running"
  const settled = phase === "done" || phase === "failed"

  // Follow the pipeline. Stops by itself once the run has finished or failed.
  useEffect(() => {
    if (settled || gone) return
    let cancelled = false
    let misses = 0
    async function tick() {
      try {
        const res = await fetch(`/api/import/${job.id}/status`, { cache: "no-store" })
        if (cancelled) return
        if (res.status === 404) return setGone(true)
        if (!res.ok) throw new Error(String(res.status))
        const data = (await res.json()) as Snapshot
        misses = 0
        setOffline(false)
        setSnap({ run: data.run, summary: data.summary, assets: data.assets })
      } catch {
        misses += 1
        if (misses >= 3 && !cancelled) setOffline(true)
      }
    }
    void tick()
    const id = setInterval(tick, 800)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [job.id, settled, gone])

  // The accent shifts to the book's type, as on the question screens.
  useEffect(() => {
    document.documentElement.setAttribute("data-genre", type)
    return () => document.documentElement.removeAttribute("data-genre")
  }, [type])

  const now = useNow(phase === "running")
  const run = snap.run
  const elapsed = run ? (run.finishedAt ?? now) - run.startedAt : 0

  // One polite announcement per stage change, not per percentage tick.
  const activeStage = run ? STAGE_ORDER.find((id) => run.stages[id].status === "active") : undefined
  const announce =
    phase === "done"
      ? "Your book is ready to review."
      : phase === "failed"
        ? "The import didn’t finish."
        : activeStage
          ? `${stageTitle(activeStage, type)}.`
          : "Getting started."

  function startOver() {
    startLeave(async () => {
      await discardImportAction(job.id)
      router.push("/projects/import")
    })
  }

  function retry() {
    setError(null)
    startRetry(async () => {
      const result = await startImportAction(job.id)
      if (!result.ok) return setError(result.error)
      setSnap({ run: null, summary: null, assets: { background: false, cover: false } })
      router.refresh()
    })
  }

  if (gone) {
    return (
      <Shell steps={steps} job={job} onLeave={startOver} leaving={leaving}>
        <div className="flex max-w-sm flex-col items-center gap-4 text-center">
          <h1 className="font-serif text-3xl font-medium">This import has expired</h1>
          <p className="text-sm leading-relaxed opacity-60">
            Uploads are only kept for a day. Nothing of yours was lost — upload the PDF again to start over.
          </p>
          <Button render={<Link href="/projects/import" />} nativeButton={false}>
            Upload a PDF
          </Button>
        </div>
      </Shell>
    )
  }

  const noun = pieceNoun(type, 2)
  const summary = snap.summary

  return (
    <Shell steps={steps} job={job} onLeave={startOver} leaving={leaving}>
      <p className="sr-only" role="status" aria-live="polite">
        {announce}
      </p>

      <header className="mb-10 flex flex-col items-center gap-3 text-center">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={phase}
            initial={reduceMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="flex flex-col items-center gap-3"
          >
            <h1 className="font-serif text-3xl font-medium sm:text-4xl">
              {phase === "done"
                ? "Your book is ready to review"
                : phase === "failed"
                  ? "That didn’t finish"
                  : "Reading your book"}
            </h1>
            <p className="max-w-md text-sm leading-relaxed opacity-60">
              {phase === "done" && summary ? (
                <>
                  {summary.pieces.toLocaleString("en-US")} {pieceNoun(type, summary.pieces)}, {summary.words.toLocaleString("en-US")} words
                  {summary.needsLook > 0
                    ? ` — and ${summary.needsLook} worth a second look. We’ll start you there.`
                    : " — and every boundary looks certain."}
                </>
              ) : phase === "failed" ? (
                "Nothing was saved. You can try again, or start over with a different file."
              ) : (
                `This takes a minute or so. Keep this tab open — we’ll find your ${noun}, set them the way you wrote them, and lift the design off the pages.`
              )}
            </p>
            {phase !== "failed" && run ? (
              <p className="text-xs tabular-nums opacity-45">
                {phase === "done" ? `Took ${clock(elapsed)}` : `Elapsed ${clock(elapsed)}`}
              </p>
            ) : null}
          </motion.div>
        </AnimatePresence>
      </header>

      <div className="grid w-full max-w-3xl items-start gap-10 md:grid-cols-[230px_1fr]">
        <div className="md:sticky md:top-8">
          <LivingPage
            jobId={job.id}
            stages={(run ?? emptyStages(job.hasFrontCover === true)).stages}
            verse={type === "poetry" || type === "custom"}
            hasBackground={snap.assets.background && run?.stages.background.status === "done"}
            hasCover={snap.assets.cover && run?.stages.cover.status === "done"}
            done={phase === "done"}
          />
        </div>

        <ol className="relative flex flex-col gap-1" aria-label="What’s happening">
          {STAGE_ORDER.map((id, index) => {
            const stage = (run ?? emptyStages(job.hasFrontCover === true)).stages[id]
            const Icon = STAGE_ICON[id]
            const failedHere = phase === "failed" && run?.error?.stage === id
            const inFlight = phase === "failed" && stage.status === "active"
            return (
              <li key={id} className="relative flex gap-4 pb-5 last:pb-0" aria-current={stage.status === "active" ? "step" : undefined}>
                {index < STAGE_ORDER.length - 1 ? (
                  <span
                    aria-hidden
                    className={cn(
                      "absolute top-9 bottom-0 left-[15px] w-px transition-colors duration-500",
                      stage.status === "done" || stage.status === "skipped" ? "bg-primary/40" : "bg-current/12"
                    )}
                  />
                ) : null}

                <Marker status={failedHere || inFlight ? "failed" : stage.status} reduceMotion={!!reduceMotion}>
                  <Icon className="size-4" weight="duotone" />
                </Marker>

                <div className="min-w-0 flex-1 pt-0.5">
                  <p
                    className={cn(
                      "font-serif text-lg leading-tight transition-opacity duration-300",
                      stage.status === "pending" ? "opacity-40" : stage.status === "skipped" ? "opacity-60" : "opacity-100"
                    )}
                  >
                    {stageTitle(id, type)}
                  </p>

                  <AnimatePresence initial={false}>
                    {stage.status === "active" && phase === "running" ? (
                      <motion.div
                        key="live"
                        initial={reduceMotion ? false : { opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                      >
                        <div className="flex flex-col gap-2.5 pt-2">
                          <p className="text-sm opacity-70">{stage.detail}</p>
                          <Bar fraction={stage.fraction} determinate={id === "background"} reduceMotion={!!reduceMotion} />
                          {id === "background" ? <Company startedAt={run?.startedAt ?? now} now={now} fraction={stage.fraction} /> : null}
                        </div>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>

                  {stage.status === "done" || stage.status === "skipped" ? (
                    <motion.ul
                      initial={reduceMotion ? false : { opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                      className="mt-1 flex flex-col gap-0.5"
                    >
                      {stage.facts.map((fact) => (
                        <li key={fact} className="text-sm leading-snug opacity-60">
                          {fact}
                        </li>
                      ))}
                    </motion.ul>
                  ) : null}

                  {failedHere && run?.error ? (
                    <p className="mt-1 text-sm leading-snug text-destructive">Stopped here.</p>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ol>
      </div>

      <footer className="mt-12 flex min-h-24 w-full max-w-3xl flex-col items-center gap-4 text-center">
        <AnimatePresence mode="wait" initial={false}>
          {phase === "done" ? (
            <motion.div
              key="done"
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.15 }}
              className="flex flex-col items-center gap-4"
            >
              {summary ? <Chips summary={summary} type={type} /> : null}
              <Button size="lg" render={<Link href={`/projects/import/${job.id}/review`} />} nativeButton={false}>
                Review your book
                <ArrowRightIcon />
              </Button>
            </motion.div>
          ) : phase === "failed" ? (
            <motion.div
              key="failed"
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="flex max-w-md flex-col items-center gap-4"
            >
              <div role="alert" className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-left text-sm leading-relaxed">
                <WarningCircleIcon className="mt-0.5 size-5 shrink-0 text-destructive" weight="duotone" />
                <span>{run?.error?.message ?? "Something went wrong while reading your book."}</span>
              </div>
              <div className="flex gap-2">
                <Button size="lg" onClick={retry} disabled={retrying}>
                  <ArrowClockwiseIcon />
                  {retrying ? "Starting…" : "Try again"}
                </Button>
                <Button size="lg" variant="ghost" onClick={startOver} disabled={leaving}>
                  Start over
                </Button>
              </div>
              {error ? (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              ) : null}
            </motion.div>
          ) : (
            <motion.p
              key="running"
              initial={false}
              animate={{ opacity: offline ? 1 : 0.5 }}
              className="text-xs leading-relaxed"
            >
              {offline
                ? "Lost touch with the server for a moment — still trying. The import carries on either way."
                : "Your original PDF isn’t changed. Nothing becomes a project until you’ve reviewed it."}
            </motion.p>
          )}
        </AnimatePresence>
      </footer>
    </Shell>
  )
}

function emptyStages(hasCover: boolean) {
  // Before the first report lands: everything waiting (and the cover row already skipped if there isn't one).
  return freshRun(hasCover)
}

function Shell({
  steps,
  job,
  onLeave,
  leaving,
  children,
}: {
  steps: React.ReactNode
  job: SerializedImportJob
  onLeave: () => void
  leaving: boolean
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col bg-manuscript-bg text-manuscript-fg">
      <div className="flex items-center justify-between p-6">
        <button
          type="button"
          onClick={onLeave}
          disabled={leaving}
          className="inline-flex items-center gap-1 text-sm opacity-60 transition-opacity outline-none hover:opacity-100 focus-visible:opacity-100 focus-visible:underline disabled:opacity-30"
        >
          <ArrowLeftIcon className="size-3.5" />
          Start over
        </button>
      </div>
      <div className="flex flex-1 flex-col items-center px-6 pb-24">
        <div className="mb-10 mt-2 flex flex-col items-center gap-5">
          {steps}
          <div className="flex max-w-full items-center gap-2 rounded-full border border-current/15 px-3 py-1 text-xs opacity-70">
            <FilePdfIcon className="size-3.5 shrink-0" weight="duotone" />
            <span className="max-w-[16rem] truncate">{job.fileName || "Your PDF"}</span>
            <span aria-hidden className="opacity-40">
              ·
            </span>
            <span className="shrink-0">{job.projectType ? projectTypeLabel(job.projectType) : "Book"}</span>
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}

function Marker({
  status,
  reduceMotion,
  children,
}: {
  status: "pending" | "active" | "done" | "skipped" | "failed"
  reduceMotion: boolean
  children: React.ReactNode
}) {
  return (
    <span className="relative flex size-8 shrink-0 items-center justify-center">
      {status === "active" && !reduceMotion ? (
        <motion.span
          aria-hidden
          className="absolute inset-0 rounded-full bg-primary/25"
          animate={{ scale: [1, 1.35, 1], opacity: [0.7, 0, 0.7] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
      ) : null}
      <motion.span
        initial={false}
        animate={status === "done" && !reduceMotion ? { scale: [0.8, 1.08, 1] } : { scale: 1 }}
        transition={{ duration: 0.35 }}
        className={cn(
          "relative flex size-8 items-center justify-center rounded-full transition-colors duration-300",
          status === "done" && "bg-primary text-primary-foreground",
          status === "active" && "bg-primary/12 text-primary ring-1 ring-primary/40",
          status === "pending" && "border border-current/20 opacity-50",
          status === "skipped" && "bg-muted text-muted-foreground",
          status === "failed" && "bg-destructive/10 text-destructive ring-1 ring-destructive/40"
        )}
      >
        {status === "done" ? (
          <CheckIcon className="size-4" weight="bold" />
        ) : status === "skipped" ? (
          <MinusIcon className="size-4" weight="bold" />
        ) : status === "failed" ? (
          <WarningCircleIcon className="size-4" weight="bold" />
        ) : (
          children
        )}
      </motion.span>
    </span>
  )
}

function Bar({ fraction, determinate, reduceMotion }: { fraction: number; determinate: boolean; reduceMotion: boolean }) {
  return (
    <div
      className="relative h-1 w-full overflow-hidden rounded-full bg-current/10"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={determinate ? Math.round(fraction * 100) : undefined}
    >
      {determinate ? (
        <motion.div
          className="h-full rounded-full bg-primary"
          initial={false}
          animate={{ width: `${Math.max(3, fraction * 100)}%` }}
          transition={{ duration: 0.45, ease: "easeOut" }}
        />
      ) : reduceMotion ? (
        <div className="h-full w-1/3 rounded-full bg-primary/70" />
      ) : (
        <motion.div
          className="absolute inset-y-0 w-1/3 rounded-full bg-primary"
          initial={{ left: "-35%" }}
          animate={{ left: "105%" }}
          transition={{ duration: 1.3, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
    </div>
  )
}

/** A line of real explanation for the slow stage — the one that most needs saying what's going on. */
function Company({ startedAt, now, fraction }: { startedAt: number; now: number; fraction: number }) {
  const started = useRef(now)
  const seconds = Math.max(0, Math.floor((now - Math.max(started.current, startedAt)) / 1000))
  const index = fraction > 0.9 ? 3 : Math.min(2, Math.floor(seconds / 5) % 3)
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.p
        key={index}
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.5 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.4 }}
        className="text-xs leading-relaxed italic"
      >
        {BACKGROUND_LINES[index]}
      </motion.p>
    </AnimatePresence>
  )
}

function Chips({ summary, type }: { summary: ImportSummary; type: ProjectType }) {
  const items = [
    `${summary.pages} pages`,
    `${summary.pieces.toLocaleString("en-US")} ${pieceNoun(type, summary.pieces)}`,
    `${summary.words.toLocaleString("en-US")} words`,
    summary.background
      ? summary.background.recommendation === "use-image"
        ? "Page design lifted"
        : "Plain background suggested"
      : "No page design",
    summary.hasCover ? "Cover ready" : "Typeset cover",
  ]
  return (
    <ul className="flex flex-wrap items-center justify-center gap-2">
      {items.map((label) => (
        <li key={label} className="rounded-full border border-current/15 bg-card/60 px-3 py-1 text-xs opacity-80">
          {label}
        </li>
      ))}
    </ul>
  )
}
