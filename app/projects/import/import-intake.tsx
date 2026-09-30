"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { upload } from "@vercel/blob/client"
import {
  ArrowLeftIcon,
  CheckIcon,
  FilePdfIcon,
  LockSimpleIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react/dist/ssr"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import {
  IMPORT_MAX_BYTES,
  IMPORT_MAX_PAGES,
  IMPORT_MULTIPART_THRESHOLD_BYTES,
  importBlobPrefix,
  rejection,
  type IntakeReport,
} from "@/lib/import/config"
import { discardImportAction, runIntakeAction } from "./actions"

type FileMeta = { name: string; size: number }

type Phase =
  | { kind: "idle" }
  | { kind: "uploading"; file: FileMeta; percent: number }
  | { kind: "checking"; file: FileMeta }
  | { kind: "passed"; file: FileMeta; jobId: string; report: IntakeReport }
  | { kind: "rejected"; file?: FileMeta; code: string; title: string; message: string }
  // A transient failure (network, expired session) — the file is kept so
  // "Try again" doesn't make the person pick it again.
  | { kind: "failed"; file: File; title: string; message: string }

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`
}

// Blob pathnames: keep it readable, keep it safe. (Blob appends its own random suffix.)
function safeBlobName(name: string): string {
  const base = name.replace(/\.pdf$/i, "").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "")
  return `${base.slice(0, 80) || "book"}.pdf`
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)

export function ImportIntake({ userId }: { userId: string }) {
  const reduceMotion = useReducedMotion()
  const inputRef = useRef<HTMLInputElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  // Bumped on every new attempt so a slow, superseded run can't overwrite the screen.
  const runRef = useRef(0)

  const [phase, setPhase] = useState<Phase>({ kind: "idle" })
  const [dragOver, setDragOver] = useState(false)

  const canPick = phase.kind === "idle" || phase.kind === "rejected" || phase.kind === "failed"

  // Land keyboard / screen-reader focus on the outcome when there is one.
  useEffect(() => {
    if (phase.kind === "passed" || phase.kind === "rejected" || phase.kind === "failed") {
      headingRef.current?.focus()
    }
  }, [phase.kind])

  useEffect(() => () => abortRef.current?.abort(), [])

  async function begin(file: File) {
    const meta: FileMeta = { name: file.name, size: file.size }

    // Everything the browser can know for free is checked before a byte is sent.
    const looksLikePdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name)
    const early = !looksLikePdf
      ? rejection("not-pdf")
      : file.size === 0
        ? rejection("empty")
        : file.size > IMPORT_MAX_BYTES
          ? rejection("too-large")
          : null
    if (early) {
      setPhase({ kind: "rejected", file: meta, code: early.code, title: early.title, message: early.message })
      return
    }

    const run = ++runRef.current
    const controller = new AbortController()
    abortRef.current = controller
    const current = () => run === runRef.current

    setPhase({ kind: "uploading", file: meta, percent: 0 })

    try {
      const blob = await upload(`${importBlobPrefix(userId)}${safeBlobName(file.name)}`, file, {
        access: "public",
        handleUploadUrl: "/api/import/upload",
        multipart: file.size > IMPORT_MULTIPART_THRESHOLD_BYTES,
        abortSignal: controller.signal,
        onUploadProgress: ({ percentage }) => {
          if (current()) setPhase({ kind: "uploading", file: meta, percent: Math.round(percentage) })
        },
      })
      if (!current()) return

      setPhase({ kind: "checking", file: meta })
      const result = await runIntakeAction({ url: blob.url, fileName: file.name })
      if (!current()) return

      if (result.ok) {
        setPhase({ kind: "passed", file: meta, jobId: result.jobId, report: result.report })
      } else {
        setPhase({ kind: "rejected", file: meta, code: result.code, title: result.title, message: result.message })
      }
    } catch (err) {
      if (!current() || controller.signal.aborted) return
      console.error("PDF import upload failed", err)
      setPhase({
        kind: "failed",
        file,
        title: "That didn’t go through",
        message: "The upload was interrupted — check your connection and try again. Nothing was saved.",
      })
    }
  }

  function reset() {
    runRef.current++
    abortRef.current?.abort()
    if (phase.kind === "passed") void discardImportAction(phase.jobId)
    setPhase({ kind: "idle" })
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    if (!canPick) return
    const file = e.dataTransfer.files?.[0]
    if (file) void begin(file)
  }

  const groupKey =
    phase.kind === "uploading" || phase.kind === "checking"
      ? "working"
      : phase.kind === "failed"
        ? "rejected"
        : phase.kind

  const fade = reduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.12 } }
    : {
        initial: { opacity: 0, y: 6 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -4 },
        transition: { duration: 0.22, ease: "easeOut" as const },
      }

  return (
    <div className="flex min-h-screen flex-col bg-manuscript-bg text-manuscript-fg">
      <div className="p-6">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-sm opacity-60 transition-opacity hover:opacity-100"
        >
          <ArrowLeftIcon className="size-3.5" />
          Dashboard
        </Link>
      </div>

      <div className="flex flex-1 items-center justify-center px-6 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="flex w-full max-w-xl flex-col items-center gap-9 text-center"
        >
          <header className="flex flex-col items-center gap-3">
            <h1 className="font-serif text-3xl font-medium sm:text-4xl">
              Bring in a book you’ve already written
            </h1>
            <p className="max-w-md text-sm leading-relaxed opacity-60">
              Upload its PDF and it becomes a real, editable project — chapters split out, formatting
              kept, and the look of its pages carried over.
            </p>
          </header>

          {/* The sheet: a small stack of pages. It fans out when a file is dragged over it. */}
          <div className="relative isolate w-full">
            <motion.div
              aria-hidden
              className="absolute inset-0 -z-10 rounded-2xl border border-current/10 bg-card/50"
              animate={{ rotate: dragOver ? -3 : -1.4, y: dragOver ? 10 : 7 }}
              transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 22 }}
            />
            <motion.div
              aria-hidden
              className="absolute inset-0 -z-10 rounded-2xl border border-current/10 bg-card/75"
              animate={{ rotate: dragOver ? 2.6 : 1, y: dragOver ? 6 : 3.5 }}
              transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 22 }}
            />

            <div
              onDragOver={(e) => {
                e.preventDefault()
                if (canPick) setDragOver(true)
              }}
              onDragLeave={(e) => {
                // Ignore leave events fired by moving between the sheet's own children.
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragOver(false)
              }}
              onDrop={handleDrop}
              className={cn(
                "relative min-h-[19rem] overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-[0_1px_2px_oklch(0_0_0/0.04),0_14px_30px_-18px_oklch(0_0_0/0.18)] transition-colors",
                dragOver ? "border-primary/60 bg-primary/5" : "border-current/15"
              )}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={groupKey} {...fade} className="flex min-h-[19rem] flex-col">
                  {phase.kind === "idle" ? (
                    <IdleView dragOver={dragOver} onPick={() => inputRef.current?.click()} />
                  ) : phase.kind === "uploading" || phase.kind === "checking" ? (
                    <WorkingView
                      phase={phase}
                      reduceMotion={!!reduceMotion}
                      onCancel={phase.kind === "uploading" ? reset : undefined}
                    />
                  ) : phase.kind === "passed" ? (
                    <PassedView phase={phase} headingRef={headingRef} onReset={reset} />
                  ) : (
                    <RejectedView
                      headingRef={headingRef}
                      file={phase.kind === "failed" ? { name: phase.file.name, size: phase.file.size } : phase.file}
                      code={phase.kind === "failed" ? "failed" : phase.code}
                      title={phase.title}
                      message={phase.message}
                      primary={
                        phase.kind === "failed"
                          ? { label: "Try again", onClick: () => void begin(phase.file) }
                          : { label: "Choose a different file", onClick: () => inputRef.current?.click() }
                      }
                      secondary={phase.kind === "failed" ? { label: "Choose a different file", onClick: () => inputRef.current?.click() } : undefined}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          <p className="max-w-sm text-xs leading-relaxed opacity-45">
            This is for continuing your own work — please don’t import someone else’s published book.
          </p>
        </motion.div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file && canPick) void begin(file)
          e.target.value = ""
        }}
      />

      {/* Screen readers hear the stage, not every percent tick. */}
      <p className="sr-only" role="status" aria-live="polite">
        {phase.kind === "uploading"
          ? "Sending your PDF."
          : phase.kind === "checking"
            ? "Checking the pages."
            : phase.kind === "passed"
              ? "Your PDF checks out."
              : ""}
      </p>
    </div>
  )
}

/* ---------------------------------------------------------------- idle */

function IdleView({ dragOver, onPick }: { dragOver: boolean; onPick: () => void }) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Choose a PDF to import"
      onClick={onPick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onPick()
        }
      }}
      className="group flex flex-1 cursor-pointer flex-col items-center justify-center gap-3 px-8 py-12 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
    >
      <div className="mb-1 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
        <FilePdfIcon className="size-6" weight="duotone" />
      </div>
      <p className="font-serif text-xl">{dragOver ? "Let go to add it" : "Drop your PDF here"}</p>
      <p className="text-sm opacity-60">
        or{" "}
        <span className="text-primary underline-offset-4 group-hover:underline group-focus-visible:underline">
          choose a file
        </span>
      </p>
      <p className="mt-4 max-w-xs text-xs leading-relaxed opacity-45">
        Up to {IMPORT_MAX_PAGES} pages, with real text — the kind Word or Google Docs exports, not
        photographed or scanned pages.
      </p>
    </div>
  )
}

/* ------------------------------------------------------------ working */

function WorkingView({
  phase,
  reduceMotion,
  onCancel,
}: {
  phase: Extract<Phase, { kind: "uploading" | "checking" }>
  reduceMotion: boolean
  onCancel?: () => void
}) {
  const uploading = phase.kind === "uploading"

  return (
    <div className="flex flex-1 flex-col justify-center gap-7 px-8 py-10 text-left sm:px-10">
      <div className="flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <FilePdfIcon className="size-5" weight="duotone" />
        </div>
        <div className="min-w-0">
          <p className="truncate font-serif text-lg">{phase.file.name}</p>
          <p className="text-xs opacity-50">{formatFileSize(phase.file.size)}</p>
        </div>
      </div>

      <ol className="flex flex-col gap-5">
        <Stage
          state={uploading ? "active" : "done"}
          label="Sending your PDF"
          detail={uploading ? `${phase.percent}%` : "Sent"}
        >
          {uploading ? (
            <div className="h-1 w-full overflow-hidden rounded-full bg-current/10">
              <motion.div
                className="h-full rounded-full bg-primary"
                animate={{ width: `${phase.percent}%` }}
                transition={{ duration: reduceMotion ? 0 : 0.25, ease: "easeOut" }}
              />
            </div>
          ) : null}
        </Stage>

        <Stage
          state={uploading ? "pending" : "active"}
          label="Checking the pages"
          detail={uploading ? undefined : "Counting pages, looking for real text"}
        >
          {!uploading ? (
            <div className="relative h-1 w-full overflow-hidden rounded-full bg-current/10">
              <motion.div
                className="absolute inset-y-0 w-1/3 rounded-full bg-primary"
                initial={{ x: "-100%" }}
                animate={reduceMotion ? { x: "100%" } : { x: ["-100%", "300%"] }}
                transition={
                  reduceMotion ? { duration: 0 } : { duration: 1.4, ease: "easeInOut", repeat: Infinity }
                }
              />
            </div>
          ) : null}
        </Stage>
      </ol>

      <div className="h-5">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="text-xs opacity-45 transition-opacity outline-none hover:opacity-100 focus-visible:underline"
          >
            Cancel
          </button>
        ) : null}
      </div>
    </div>
  )
}

function Stage({
  state,
  label,
  detail,
  children,
}: {
  state: "pending" | "active" | "done"
  label: string
  detail?: string
  children?: React.ReactNode
}) {
  return (
    <li className={cn("flex flex-col gap-2 transition-opacity", state === "pending" && "opacity-35")}>
      <div className="flex items-center gap-2.5">
        <span className="flex size-5 shrink-0 items-center justify-center">
          {state === "done" ? (
            <motion.span
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 420, damping: 18 }}
              className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground"
            >
              <CheckIcon className="size-3" weight="bold" />
            </motion.span>
          ) : state === "active" ? (
            <span className="size-4 animate-spin rounded-full border-2 border-primary/25 border-t-primary motion-reduce:animate-none" />
          ) : (
            <span className="size-4 rounded-full border-2 border-current/25" />
          )}
        </span>
        <span className="text-sm font-medium">{label}</span>
        {detail ? <span className="ml-auto text-xs tabular-nums opacity-55">{detail}</span> : null}
      </div>
      {children ? <div className="pl-[1.875rem]">{children}</div> : null}
    </li>
  )
}

/* ------------------------------------------------------------- passed */

function PassedView({
  phase,
  headingRef,
  onReset,
}: {
  phase: Extract<Phase, { kind: "passed" }>
  headingRef: React.RefObject<HTMLHeadingElement | null>
  onReset: () => void
}) {
  const { report, file } = phase
  const about = report.imageOnlyApproximate ? "about " : ""

  const stats: { value: number; label: string }[] = [
    { value: report.pageCount, label: plural(report.pageCount, "page", "pages") },
    { value: report.textPages, label: "with text" },
  ]
  if (report.imageOnlyPages > 0) stats.push({ value: report.imageOnlyPages, label: "image only" })
  if (report.blankPages > 0) stats.push({ value: report.blankPages, label: "blank" })

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 px-8 py-10 text-center">
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 340, damping: 16, delay: 0.05 }}
        className="flex size-11 items-center justify-center rounded-full bg-accent text-accent-foreground"
      >
        <CheckIcon className="size-5" weight="bold" />
      </motion.div>

      <div className="flex flex-col items-center gap-1">
        <h2 ref={headingRef} tabIndex={-1} className="font-serif text-2xl outline-none">
          Your PDF checks out
        </h2>
        <p className="max-w-full truncate text-xs opacity-50">
          {file.name} · {formatFileSize(file.size)}
        </p>
      </div>

      <dl className="flex items-stretch justify-center divide-x divide-current/15">
        {stats.map((s) => (
          <div key={s.label} className="flex flex-col items-center gap-0.5 px-5 first:pl-0 last:pr-0">
            <dt className="order-2 text-[11px] tracking-wide uppercase opacity-50">{s.label}</dt>
            <dd className="font-serif text-2xl tabular-nums">{s.value}</dd>
          </div>
        ))}
      </dl>

      <div className="flex max-w-sm flex-col gap-1.5 text-sm leading-relaxed opacity-65">
        {report.imageOnlyPages > 0 ? (
          <p>
            {about}
            {report.imageOnlyPages} {plural(report.imageOnlyPages, "page is a picture", "pages are pictures")}{" "}
            with no text — likely {plural(report.imageOnlyPages, "an illustration", "illustrations")}. We’ll
            point {plural(report.imageOnlyPages, "it", "them")} out when you review.
          </p>
        ) : null}
        {report.encrypted ? (
          <p className="text-xs opacity-80">
            This PDF is encrypted, but it opens without a password and allows copying, so it can be read.
          </p>
        ) : null}
      </div>

      <div className="mt-1 flex flex-col items-center gap-3">
        <p className="text-xs opacity-45">Next, you’ll tell us what kind of book this is.</p>
        <Button variant="ghost" size="sm" onClick={onReset}>
          Choose a different file
        </Button>
      </div>
    </div>
  )
}

/* ----------------------------------------------------------- rejected */

function RejectedView({
  headingRef,
  file,
  code,
  title,
  message,
  primary,
  secondary,
}: {
  headingRef: React.RefObject<HTMLHeadingElement | null>
  file?: FileMeta
  code: string
  title: string
  message: string
  primary: { label: string; onClick: () => void }
  secondary?: { label: string; onClick: () => void }
}) {
  const Glyph = code === "password-protected" || code === "copy-restricted" ? LockSimpleIcon : WarningCircleIcon

  return (
    <div role="alert" className="flex flex-1 flex-col items-center justify-center gap-4 px-8 py-10 text-center">
      <div className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Glyph className="size-5" weight="duotone" />
      </div>

      <div className="flex flex-col items-center gap-2">
        <h2 ref={headingRef} tabIndex={-1} className="font-serif text-2xl outline-none">
          {title}
        </h2>
        {file ? (
          <p className="max-w-full truncate text-xs opacity-45">
            {file.name} · {formatFileSize(file.size)}
          </p>
        ) : null}
        <p className="max-w-sm text-sm leading-relaxed opacity-70">{message}</p>
      </div>

      <div className="mt-1 flex items-center gap-2">
        <Button variant="outline" onClick={primary.onClick}>
          {primary.label}
        </Button>
        {secondary ? (
          <Button variant="ghost" onClick={secondary.onClick}>
            {secondary.label}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
