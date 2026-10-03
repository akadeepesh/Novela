"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BookBookmarkIcon,
  CheckIcon,
  FilePdfIcon,
  ImageSquareIcon,
  TextAaIcon,
} from "@phosphor-icons/react/dist/ssr"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { PROJECT_TYPES, PROJECT_TYPE_ICON, projectTypeLabel, type ProjectType } from "@/lib/project-config"
import { IMPORT_SPLIT_HINT } from "@/lib/import/config"
import type { SerializedImportJob } from "@/lib/import/jobs"
import { discardImportAction, saveImportIntentAction, startImportAction } from "../actions"

type Stage = "type" | "cover" | "saved"

// Short, import-specific blurbs. The labels and icons come from the shared
// project config; these differ from the creation screen's descriptions
// because they describe a book that already exists.
const TYPE_BLURB: Record<ProjectType, string> = {
  novel: "Chapters of prose — fiction, memoir, or non-fiction.",
  poetry: "A collection of poems, one after another.",
  "script-writing": "Scripts for video or audio, one per episode.",
  custom: "Something else — you’ll shape the structure yourself.",
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)

export function ImportIntent({ job, steps }: { job: SerializedImportJob; steps: React.ReactNode }) {
  const router = useRouter()
  const reduceMotion = useReducedMotion()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const groupRef = useRef<HTMLDivElement>(null)
  const firstRender = useRef(true)

  const [stage, setStage] = useState<Stage>(job.status === "intent-set" ? "saved" : "type")
  const [direction, setDirection] = useState<1 | -1>(1)
  const [type, setType] = useState<ProjectType | null>(job.projectType ?? null)
  const [cover, setCover] = useState<boolean | null>(job.hasFrontCover ?? null)
  const [error, setError] = useState<string | null>(null)
  const [saving, startSave] = useTransition()
  const [leaving, startLeave] = useTransition()
  const [starting, startBegin] = useTransition()

  // Same trick as the creation canvas: the app's accent shifts to the book's
  // type as soon as it's chosen, so the choice visibly *lands*.
  useEffect(() => {
    if (!type) return
    document.documentElement.setAttribute("data-genre", type)
    return () => document.documentElement.removeAttribute("data-genre")
  }, [type])

  // Move focus to the new question's heading on every stage change (but not
  // on first paint, where it would steal focus from the page itself).
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    headingRef.current?.focus()
  }, [stage])

  function go(next: Stage, dir: 1 | -1) {
    setError(null)
    setDirection(dir)
    setStage(next)
  }

  function save() {
    if (!type || cover === null) return
    setError(null)
    startSave(async () => {
      const result = await saveImportIntentAction(job.id, { projectType: type, hasFrontCover: cover })
      if (result.ok) go("saved", 1)
      else setError(result.error)
    })
  }

  function begin() {
    setError(null)
    startBegin(async () => {
      const result = await startImportAction(job.id)
      if (result.ok) router.refresh()
      else setError(result.error)
    })
  }

  function startOver() {
    startLeave(async () => {
      await discardImportAction(job.id)
      router.push("/projects/import")
    })
  }

  // Radio-group keyboard behaviour, same as the creation canvas: arrows move the selection.
  function handleTypeKeyDown(e: React.KeyboardEvent) {
    const forward = e.key === "ArrowRight" || e.key === "ArrowDown"
    const back = e.key === "ArrowLeft" || e.key === "ArrowUp"
    if (e.key === "Enter" && type) {
      e.preventDefault()
      go("cover", 1)
      return
    }
    if (!forward && !back) return
    e.preventDefault()
    const values = PROJECT_TYPES.map((t) => t.value) as ProjectType[]
    const from = type ? values.indexOf(type) : back ? 0 : -1
    const next = values[(from + (forward ? 1 : -1) + values.length) % values.length]
    setType(next)
    requestAnimationFrame(() => groupRef.current?.querySelector<HTMLElement>(`[data-type="${next}"]`)?.focus())
  }

  const slide = (dir: 1 | -1) =>
    reduceMotion
      ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.12 } }
      : {
          initial: { opacity: 0, x: 22 * dir },
          animate: { opacity: 1, x: 0 },
          exit: { opacity: 0, x: -22 * dir },
          transition: { duration: 0.24, ease: "easeOut" as const },
        }

  return (
    <div className="flex min-h-screen flex-col bg-manuscript-bg text-manuscript-fg">
      <div className="flex items-center justify-between p-6">
        <button
          type="button"
          onClick={startOver}
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
            <span aria-hidden className="opacity-40">·</span>
            <span className="shrink-0 tabular-nums">
              {job.intake.pageCount} {plural(job.intake.pageCount, "page", "pages")}
            </span>
          </div>
        </div>

        <div className="flex w-full max-w-2xl flex-1 flex-col items-center justify-start">
          <AnimatePresence mode="wait" initial={false} custom={direction}>
            {stage === "type" ? (
              <motion.section
                key="type"
                {...slide(direction)}
                className="flex w-full flex-col items-center gap-8 text-center"
                aria-labelledby="q-type"
              >
                <Question
                  headingRef={headingRef}
                  id="q-type"
                  index={1}
                  title="What kind of book is this?"
                  sub="This decides how we look for where one piece ends and the next begins."
                />

                <div
                  ref={groupRef}
                  role="radiogroup"
                  aria-labelledby="q-type"
                  onKeyDown={handleTypeKeyDown}
                  className="grid w-full gap-3 text-left sm:grid-cols-2"
                >
                  {PROJECT_TYPES.map((t, i) => {
                    const TypeIcon = PROJECT_TYPE_ICON[t.value]
                    const active = type === t.value
                    return (
                      <motion.button
                        key={t.value}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        data-type={t.value}
                        // With nothing chosen yet, the first card is the tab stop.
                        tabIndex={active || (!type && i === 0) ? 0 : -1}
                        onClick={() => setType(t.value)}
                        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.28, delay: reduceMotion ? 0 : 0.05 * i, ease: "easeOut" }}
                        whileTap={reduceMotion ? undefined : { scale: 0.985 }}
                        className={cn(
                          "group relative flex flex-col gap-3 rounded-2xl border p-5 outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
                          active
                            ? "border-primary/60 bg-primary/8 shadow-[0_10px_24px_-16px_var(--primary)]"
                            : "border-current/15 bg-card/60 hover:border-current/30 hover:bg-card"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={cn(
                              "flex size-9 shrink-0 items-center justify-center rounded-full transition-colors",
                              active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                            )}
                          >
                            <TypeIcon className="size-4.5" weight={active ? "fill" : "duotone"} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block font-serif text-lg leading-tight">{t.label}</span>
                            <span className="block text-xs opacity-55">{TYPE_BLURB[t.value]}</span>
                          </span>
                          <span
                            aria-hidden
                            className={cn(
                              "flex size-5 shrink-0 items-center justify-center rounded-full border transition-all",
                              active ? "border-primary bg-primary text-primary-foreground" : "border-current/25"
                            )}
                          >
                            {active ? <CheckIcon className="size-3" weight="bold" /> : null}
                          </span>
                        </div>

                        <p className="border-t border-current/10 pt-3 text-xs leading-relaxed opacity-60">
                          {IMPORT_SPLIT_HINT[t.value]}
                        </p>
                      </motion.button>
                    )
                  })}
                </div>

                <Actions>
                  <Button size="lg" disabled={!type} onClick={() => go("cover", 1)}>
                    Continue
                    <ArrowRightIcon />
                  </Button>
                </Actions>
              </motion.section>
            ) : stage === "cover" ? (
              <motion.section
                key="cover"
                {...slide(direction)}
                className="flex w-full flex-col items-center gap-8 text-center"
                aria-labelledby="q-cover"
              >
                <Question
                  headingRef={headingRef}
                  id="q-cover"
                  index={2}
                  title="Does the PDF start with a front cover?"
                  sub="A cover is usually a designed picture with the title on it. Many print-ready files leave it out — the cover is uploaded separately."
                />

                <div role="radiogroup" aria-labelledby="q-cover" className="grid w-full gap-3 text-left sm:grid-cols-2">
                  <CoverChoice
                    active={cover === true}
                    icon={<ImageSquareIcon className="size-4.5" weight={cover === true ? "fill" : "duotone"} />}
                    title="Yes, page 1 is the cover"
                    body="We’ll use it as your book’s front cover, and leave it out of the text."
                    onSelect={() => setCover(true)}
                  />
                  <CoverChoice
                    active={cover === false}
                    icon={<TextAaIcon className="size-4.5" weight={cover === false ? "fill" : "duotone"} />}
                    title="No, it starts with the book"
                    body="Page 1 is part of the book. Until you add a cover of your own, it gets a clean one typeset from your title."
                    onSelect={() => setCover(false)}
                  />
                </div>

                <Actions error={error}>
                  <Button variant="ghost" size="lg" onClick={() => go("type", -1)} disabled={saving}>
                    <ArrowLeftIcon />
                    Back
                  </Button>
                  <Button size="lg" disabled={cover === null || saving} onClick={save}>
                    {saving ? "Saving…" : "Save answers"}
                    {saving ? null : <ArrowRightIcon />}
                  </Button>
                </Actions>
              </motion.section>
            ) : (
              <motion.section
                key="saved"
                {...slide(direction)}
                className="flex w-full max-w-md flex-col items-center gap-7 text-center"
                aria-labelledby="q-saved"
              >
                <div className="flex flex-col items-center gap-3">
                  <motion.span
                    initial={reduceMotion ? false : { scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 340, damping: 16, delay: 0.05 }}
                    className="flex size-11 items-center justify-center rounded-full bg-accent text-accent-foreground"
                  >
                    <CheckIcon className="size-5" weight="bold" />
                  </motion.span>
                  <h1 id="q-saved" ref={headingRef} tabIndex={-1} className="font-serif text-3xl font-medium outline-none">
                    That’s everything we need
                  </h1>
                </div>

                <dl className="w-full divide-y divide-current/10 rounded-2xl border border-current/15 bg-card/60 text-left text-sm">
                  <Recap label="Book">
                    <span className="flex items-center gap-2">
                      <BookBookmarkIcon className="size-4 opacity-50" weight="duotone" />
                      <span className="truncate">{job.fileName || "Your PDF"}</span>
                    </span>
                    <span className="text-xs tabular-nums opacity-50">
                      {job.intake.pageCount} {plural(job.intake.pageCount, "page", "pages")}
                    </span>
                  </Recap>
                  <Recap label="Kind">
                    <span>{type ? projectTypeLabel(type) : "—"}</span>
                  </Recap>
                  <Recap label="Front cover">
                    <span>{cover ? "Page 1 of the PDF" : "None — a typeset one for now"}</span>
                  </Recap>
                </dl>

                <div className="flex flex-col items-center gap-3">
                  <Button size="lg" onClick={begin} disabled={starting}>
                    {starting ? "Starting…" : "Start importing"}
                    {starting ? null : <ArrowRightIcon />}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => go("type", -1)} disabled={starting}>
                    Change answers
                  </Button>
                  {error ? (
                    <p role="alert" className="text-sm text-destructive">
                      {error}
                    </p>
                  ) : null}
                </div>
              </motion.section>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

function Question({
  headingRef,
  id,
  index,
  title,
  sub,
}: {
  headingRef: React.RefObject<HTMLHeadingElement | null>
  id: string
  index: number
  title: string
  sub: string
}) {
  return (
    <header className="flex flex-col items-center gap-3">
      <p className="text-[11px] tracking-wide uppercase opacity-45">Question {index} of 2</p>
      <h1 id={id} ref={headingRef} tabIndex={-1} className="font-serif text-3xl font-medium outline-none sm:text-4xl">
        {title}
      </h1>
      <p className="max-w-md text-sm leading-relaxed opacity-60">{sub}</p>
    </header>
  )
}

function CoverChoice({
  active,
  icon,
  title,
  body,
  onSelect,
}: {
  active: boolean
  icon: React.ReactNode
  title: string
  body: string
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onSelect}
      className={cn(
        "flex flex-col gap-3 rounded-2xl border p-5 text-left outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
        active
          ? "border-primary/60 bg-primary/8 shadow-[0_10px_24px_-16px_var(--primary)]"
          : "border-current/15 bg-card/60 hover:border-current/30 hover:bg-card"
      )}
    >
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-full transition-colors",
            active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          )}
        >
          {icon}
        </span>
        <span className="min-w-0 flex-1 font-serif text-lg leading-tight">{title}</span>
        <span
          aria-hidden
          className={cn(
            "flex size-5 shrink-0 items-center justify-center rounded-full border transition-all",
            active ? "border-primary bg-primary text-primary-foreground" : "border-current/25"
          )}
        >
          {active ? <CheckIcon className="size-3" weight="bold" /> : null}
        </span>
      </div>
      <p className="text-xs leading-relaxed opacity-60">{body}</p>
    </button>
  )
}

function Actions({ children, error }: { children: React.ReactNode; error?: string | null }) {
  return (
    <div className="mt-1 flex flex-col items-center gap-3">
      <div className="flex items-center gap-2">{children}</div>
      <p role="alert" className="min-h-4 text-xs text-destructive">
        {error ?? ""}
      </p>
    </div>
  )
}

function Recap({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <dt className="text-xs tracking-wide uppercase opacity-45">{label}</dt>
      <dd className="flex min-w-0 items-center gap-3">{children}</dd>
    </div>
  )
}
