"use client"

import { useEffect, useState } from "react"
import { cn } from "cn"
import { ListChecksIcon } from "@phosphor-icons/react/dist/ssr"

const BEFORE = "The harbour at Graywater was quiet when Mara reached the end of the pier. Fog rolled in off the water, and the lamps hissed. "
const TYPED = "“You came back,” Tomas said, stepping out of the fog."

const ISSUES = [
  {
    rule: "Dead characters",
    tone: "bg-amber-500",
    text: "Tomas is marked dead from Chapter 3, “The Fall”, but he speaks here.",
    mark: "Tomas said",
  },
  {
    rule: "Name spelling",
    tone: "bg-sky-500",
    text: "“Graywater” looks like a misspelling of Greywater.",
    mark: "Graywater",
  },
] as const

/** How long each phase lasts, in ms. Typing runs per character. */
const TYPE_MS = 45
const CHECK_MS = 900
const CARD_GAP_MS = 700
const HOLD_MS = 4200

type Phase = { typed: number; checking: boolean; cards: number }
const DONE: Phase = { typed: TYPED.length, checking: false, cards: ISSUES.length }

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    const update = () => setReduced(mq.matches)
    update()
    mq.addEventListener("change", update)
    return () => mq.removeEventListener("change", update)
  }, [])
  return reduced
}

/**
 * The landing page's looping demo: a sentence is typed that brings a dead
 * character back, and Story Check flags it. A scripted mock of the real
 * panel (no app code runs here). With reduced motion it shows the end state.
 */
export function StoryCheckDemo() {
  const reduced = usePrefersReducedMotion()
  const [phase, setPhase] = useState<Phase>({ typed: 0, checking: false, cards: 0 })

  useEffect(() => {
    if (reduced) return
    let timer: ReturnType<typeof setTimeout>
    const step = (p: Phase) => {
      let next: Phase
      let delay: number
      if (p.typed < TYPED.length) {
        next = { ...p, typed: p.typed + 1 }
        delay = TYPE_MS
      } else if (!p.checking && p.cards === 0) {
        next = { ...p, checking: true }
        delay = CHECK_MS
      } else if (p.cards < ISSUES.length) {
        next = { ...p, checking: false, cards: p.cards + 1 }
        delay = CARD_GAP_MS
      } else {
        next = { typed: 0, checking: false, cards: 0 }
        delay = HOLD_MS
      }
      timer = setTimeout(() => {
        setPhase(next)
        step(next)
      }, delay)
    }
    timer = setTimeout(() => step({ typed: 0, checking: false, cards: 0 }), 600)
    return () => clearTimeout(timer)
  }, [reduced])

  const p = reduced ? DONE : phase
  const typed = TYPED.slice(0, p.typed)
  const flagged = (s: string) => p.cards > ISSUES.findIndex((i) => i.mark === s)

  // Underline flagged words once their card is showing.
  const renderText = (text: string) => {
    const parts: React.ReactNode[] = []
    let rest = text
    let key = 0
    while (rest) {
      const hit = ISSUES.map((i) => ({ i, at: rest.indexOf(i.mark) }))
        .filter((h) => h.at >= 0)
        .sort((a, b) => a.at - b.at)[0]
      if (!hit) {
        parts.push(rest)
        break
      }
      parts.push(rest.slice(0, hit.at))
      parts.push(
        <span
          key={key++}
          className={cn(
            "transition-colors duration-500",
            flagged(hit.i.mark) && "rounded-sm bg-amber-200/60 underline decoration-amber-500 decoration-wavy underline-offset-4 dark:bg-amber-500/20"
          )}
        >
          {hit.i.mark}
        </span>
      )
      rest = rest.slice(hit.at + hit.i.mark.length)
    }
    return parts
  }

  return (
    <div
      className="overflow-hidden rounded-xl border border-border bg-card shadow-xl shadow-foreground/5"
      role="img"
      aria-label="Demo: a writer types a line where Tomas speaks, though he died in Chapter 3. Story Check flags it, and also flags “Graywater” as a misspelling of the town Greywater."
    >
      <div className="flex items-center gap-1.5 border-b border-border px-4 py-2.5" aria-hidden>
        <span className="size-2.5 rounded-full bg-border" />
        <span className="size-2.5 rounded-full bg-border" />
        <span className="size-2.5 rounded-full bg-border" />
        <span className="ml-3 text-xs text-muted-foreground">Chapter 9 · The Return</span>
      </div>
      <div className="grid min-h-[300px] sm:grid-cols-[1fr_15rem]" aria-hidden>
        <div className="p-6 font-serif text-[15px] leading-relaxed text-foreground sm:p-8">
          <p className="mb-4 font-heading text-lg font-semibold">Chapter 9</p>
          <p>
            {renderText(BEFORE)}
            {renderText(typed)}
            {p.typed < TYPED.length ? <span className="ml-px inline-block h-[1.1em] w-px animate-pulse bg-foreground align-text-bottom" /> : null}
          </p>
        </div>
        <div className="border-t border-border bg-muted/30 p-3 sm:border-t-0 sm:border-l">
          <p className="mb-3 flex items-center gap-1.5 text-xs font-medium text-foreground">
            <ListChecksIcon className="size-3.5" />
            Story Check
            {p.checking ? <span className="font-normal text-muted-foreground">checking…</span> : null}
          </p>
          <div className="flex flex-col gap-2">
            {ISSUES.map((issue, i) => (
              <div
                key={issue.rule}
                className={cn(
                  "rounded-md border border-border bg-card p-2.5 transition-all duration-500",
                  p.cards > i ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0"
                )}
              >
                <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                  <span className={cn("size-1.5 rounded-full", issue.tone)} />
                  {issue.rule}
                </p>
                <p className="mt-1 text-xs text-foreground">{issue.text}</p>
                <p className="mt-1.5 flex gap-3 text-[11px] font-medium">
                  <span className="text-primary">Go to text</span>
                  <span className="text-muted-foreground">Ignore</span>
                </p>
              </div>
            ))}
            {p.cards === 0 && !p.checking ? <p className="text-xs text-muted-foreground">Nothing to report yet.</p> : null}
          </div>
        </div>
      </div>
    </div>
  )
}
