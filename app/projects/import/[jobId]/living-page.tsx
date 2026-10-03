"use client"

import { motion, useReducedMotion } from "motion/react"
import { cn } from "cn"
import type { StageId, StageState } from "@/lib/import/pipeline/types"

// A sheet of paper that comes to life as the import works: ink lines appear as
// the text is read, separators as the pieces are found, and — when they're
// ready — the book's real background and cover fade in from the files the
// pipeline produced. It's a picture of the work, not decoration.

const LINE_WIDTHS = [0.82, 0.64, 0.74, 0.5, 0.78, 0.6, 0.7, 0.46, 0.8, 0.58, 0.68]
const GROUPS = [4, 4, 3]

export function LivingPage({
  jobId,
  stages,
  verse,
  hasBackground,
  hasCover,
  done,
}: {
  jobId: string
  stages: Record<StageId, StageState>
  /** Poems are drawn centered with ornaments between them; prose gets a heading bar and left-aligned lines. */
  verse: boolean
  hasBackground: boolean
  hasCover: boolean
  done: boolean
}) {
  const reduceMotion = useReducedMotion()
  const reading = stages.text.status === "active"
  const textDone = stages.text.status === "done" || stages.structure.status !== "pending"
  const structured = stages.structure.status === "done" || stages.format.status !== "pending"
  const lifting = stages.background.status === "active"

  let line = -1

  return (
    <div className="relative mx-auto w-[210px] select-none" aria-hidden>
      {/* the cover, tucked behind the page */}
      <motion.div
        initial={false}
        animate={{ opacity: hasCover ? 1 : 0, rotate: hasCover ? -7 : -2, x: hasCover ? -26 : 0 }}
        transition={{ type: "spring", stiffness: 120, damping: 16 }}
        className="absolute top-3 left-0 aspect-[2/3] w-[160px] overflow-hidden rounded-md border border-current/15 bg-muted shadow-[0_18px_30px_-18px_rgb(0_0_0/0.45)]"
      >
        {hasCover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/import/${jobId}/asset/cover`} alt="" className="size-full object-cover" />
        ) : null}
      </motion.div>

      {/* the page itself */}
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="relative aspect-[2/3] w-full overflow-hidden rounded-md border border-current/15 bg-card shadow-[0_24px_40px_-22px_rgb(0_0_0/0.5)]"
      >
        {/* the lifted background */}
        {hasBackground ? (
          <motion.img
            // eslint-disable-next-line @next/next/no-img-element
            src={`/api/import/${jobId}/asset/background`}
            alt=""
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.9, ease: "easeOut" }}
            className="absolute inset-0 size-full object-cover"
          />
        ) : null}

        {/* while the background is being lifted, a slow wash passes over the page */}
        {lifting && !reduceMotion ? (
          <motion.div
            className="absolute inset-x-0 h-1/2 bg-gradient-to-b from-transparent via-primary/12 to-transparent"
            initial={{ y: "-60%" }}
            animate={{ y: "220%" }}
            transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
          />
        ) : null}

        {/* the writing */}
        <div className="absolute inset-0 flex flex-col justify-center gap-[7px] px-[14%] py-[18%]">
          {!verse ? (
            <motion.span
              initial={false}
              animate={{ opacity: structured ? 0.7 : 0, scaleX: structured ? 1 : 0.3 }}
              transition={{ duration: 0.5 }}
              className="mb-1 h-[5px] w-[38%] origin-left rounded-full bg-current"
            />
          ) : null}
          {GROUPS.map((count, g) => (
            <div key={g} className="flex flex-col gap-[7px]">
              {Array.from({ length: count }).map((_, i) => {
                line += 1
                const n = line
                const width = LINE_WIDTHS[n % LINE_WIDTHS.length]
                return (
                  <motion.span
                    key={i}
                    initial={false}
                    animate={
                      reading && !reduceMotion
                        ? { opacity: [0, 0.5, 0.5, 0.5], scaleX: [0.2, 1, 1, 1] }
                        : { opacity: textDone || reading ? 0.5 : 0, scaleX: 1 }
                    }
                    transition={
                      reading && !reduceMotion
                        ? { duration: 2.2, repeat: Infinity, delay: n * 0.11, times: [0, 0.25, 0.9, 1] }
                        : { duration: 0.4 }
                    }
                    style={{ width: `${width * 100}%`, transformOrigin: verse ? "center" : "left" }}
                    className={cn("h-[3px] rounded-full bg-current", verse && "mx-auto")}
                  />
                )
              })}
              {g < GROUPS.length - 1 ? (
                <motion.span
                  initial={false}
                  animate={{ opacity: structured ? 0.6 : 0, scale: structured ? 1 : 0.4 }}
                  transition={{ duration: 0.45, delay: g * 0.12 }}
                  className={cn(
                    "my-1.5 block size-[5px] rotate-45 bg-primary",
                    verse ? "mx-auto" : "hidden"
                  )}
                />
              ) : null}
            </div>
          ))}
        </div>

        {/* a settled tick once everything's in */}
        {done ? (
          <motion.span
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="absolute inset-x-0 bottom-[7%] mx-auto h-[3px] w-6 rounded-full bg-current/40"
          />
        ) : null}
      </motion.div>
    </div>
  )
}
