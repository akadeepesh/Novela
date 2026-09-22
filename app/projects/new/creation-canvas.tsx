"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { ArrowLeftIcon, ArrowRightIcon } from "@phosphor-icons/react/dist/ssr"
import { cn } from "cn"
import {
  PROJECT_TYPES,
  PROJECT_TYPE_ICON,
  defaultProjectTitle,
  type ProjectType,
} from "@/lib/project-config"
import { measureFlightStart, useTitleFlight } from "@/components/project/title-flight"
import { createProjectAction } from "./actions"

const TAGLINE: Record<ProjectType, string> = {
  novel: "A novel",
  poetry: "A poetry collection",
  "short-stories": "A short story collection",
  nonfiction: "Non-fiction or memoir",
  "script-writing": "A script — one per episode",
  custom: "A custom project",
}

// Long titles step down instead of scrolling sideways inside the field.
function titleSize(length: number): string {
  if (length > 44) return "text-2xl sm:text-3xl"
  if (length > 26) return "text-3xl sm:text-4xl"
  return "text-4xl sm:text-5xl"
}

export function CreationCanvas() {
  const router = useRouter()
  const flight = useTitleFlight()
  const reduceMotion = useReducedMotion()
  const inputRef = useRef<HTMLInputElement>(null)
  const groupRef = useRef<HTMLDivElement>(null)

  const [title, setTitle] = useState("")
  const [type, setType] = useState<ProjectType>("novel")
  const [committing, setCommitting] = useState(false)
  const [failed, setFailed] = useState(false)

  const placeholder = defaultProjectTitle(type)

  // Preview the book you're making: the accent shifts with the chosen type,
  // exactly as it will inside the editor, so nothing "pops" on arrival.
  useEffect(() => {
    document.documentElement.setAttribute("data-genre", type)
    return () => document.documentElement.removeAttribute("data-genre")
  }, [type])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (committing) return
    setCommitting(true)
    setFailed(false)

    // Lift the title off the canvas *before* anything else changes, so the
    // flying copy starts pixel-for-pixel where the typed text is.
    if (!reduceMotion && inputRef.current) {
      const trimmed = title.trim()
      flight.start(measureFlightStart(inputRef.current, trimmed || placeholder, !trimmed))
    }

    try {
      const { projectId, chapterId } = await createProjectAction({ title, type })
      router.push(`/projects/${projectId}/chapters/${chapterId}`)
    } catch {
      flight.cancel()
      setCommitting(false)
      setFailed(true)
    }
  }

  // Radio-group keyboard behaviour: arrows move the selection.
  function handleTypeKeyDown(e: React.KeyboardEvent) {
    const forward = e.key === "ArrowRight" || e.key === "ArrowDown"
    const back = e.key === "ArrowLeft" || e.key === "ArrowUp"
    if (!forward && !back) return
    e.preventDefault()
    const values = PROJECT_TYPES.map((t) => t.value) as ProjectType[]
    const next = values[(values.indexOf(type) + (forward ? 1 : -1) + values.length) % values.length]
    setType(next)
    requestAnimationFrame(() =>
      groupRef.current?.querySelector<HTMLElement>(`[data-type="${next}"]`)?.focus()
    )
  }

  // Everything except the title recedes once you commit.
  const recede = { opacity: committing ? 0 : 1 }

  return (
    <div className="flex min-h-screen flex-col bg-manuscript-bg text-manuscript-fg">
      <motion.div className="p-6" animate={recede} transition={{ duration: 0.25 }}>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-sm opacity-60 transition-opacity hover:opacity-100"
        >
          <ArrowLeftIcon className="size-3.5" />
          Dashboard
        </Link>
      </motion.div>

      <div className="flex flex-1 items-center justify-center px-6 pb-24">
        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="flex w-full max-w-3xl flex-col items-center gap-8 text-center"
        >
          <input
            ref={inputRef}
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={placeholder}
            maxLength={200}
            aria-label="Title"
            // The flying copy takes over the instant you commit.
            style={{ visibility: flight.active ? "hidden" : "visible" }}
            className={cn(
              "w-full bg-transparent text-center font-serif font-medium caret-primary outline-none placeholder:opacity-30",
              titleSize((title || placeholder).length)
            )}
          />

          <motion.div
            className="flex flex-col items-center gap-3"
            animate={recede}
            transition={{ duration: 0.25 }}
          >
            <div
              ref={groupRef}
              role="radiogroup"
              aria-label="What are you writing?"
              onKeyDown={handleTypeKeyDown}
              className="flex flex-wrap items-center justify-center gap-2"
            >
              {PROJECT_TYPES.map((t) => {
                const TypeIcon = PROJECT_TYPE_ICON[t.value]
                const active = type === t.value
                return (
                  <button
                    key={t.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    data-type={t.value}
                    tabIndex={active ? 0 : -1}
                    onClick={() => setType(t.value)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      active
                        ? "border-primary/60 bg-primary/10 text-primary"
                        : "border-current/15 opacity-50 hover:opacity-100"
                    )}
                  >
                    <TypeIcon className="size-3.5" weight={active ? "fill" : "regular"} />
                    {t.shortLabel}
                  </button>
                )
              })}
            </div>

            <div className="h-4">
              <AnimatePresence mode="wait" initial={false}>
                <motion.p
                  key={type}
                  initial={{ opacity: 0, y: 3 }}
                  animate={{ opacity: 0.45, y: 0 }}
                  exit={{ opacity: 0, y: -3 }}
                  transition={{ duration: 0.14 }}
                  className="text-xs"
                >
                  {TAGLINE[type]}
                </motion.p>
              </AnimatePresence>
            </div>
          </motion.div>

          <motion.div className="mt-2 flex flex-col items-center gap-2" animate={recede} transition={{ duration: 0.25 }}>
            <button
              type="submit"
              disabled={committing}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary transition-all outline-none hover:gap-2.5 focus-visible:underline"
            >
              Begin writing
              <ArrowRightIcon className="size-4" />
              <kbd className="ml-1 hidden rounded border border-current/20 px-1.5 text-[11px] font-normal opacity-50 sm:inline">
                ↵
              </kbd>
            </button>
            {failed ? (
              <p role="alert" className="text-xs text-destructive">
                Couldn’t create it just now — try again.
              </p>
            ) : null}
          </motion.div>
        </motion.form>
      </div>
    </div>
  )
}
