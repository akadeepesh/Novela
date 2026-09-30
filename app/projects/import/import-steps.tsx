import { CheckIcon } from "@phosphor-icons/react/dist/ssr"
import { cn } from "cn"

// The four things the person actually experiences. (Reading the text,
// finding chapters, lifting the background and building the cover all
// happen inside "Reading".)
const STEPS = ["Upload", "About your book", "Reading", "Review"] as const

/** A quiet "you are here" for the whole import — shared by every screen in the flow. */
export function ImportSteps({ current }: { current: 0 | 1 | 2 | 3 }) {
  return (
    <ol aria-label="Import progress" className="flex items-center justify-center gap-2 text-[11px] sm:gap-3">
      {STEPS.map((label, i) => {
        const done = i < current
        const active = i === current
        return (
          <li
            key={label}
            aria-current={active ? "step" : undefined}
            className={cn(
              "flex items-center gap-2 transition-opacity sm:gap-3",
              active ? "opacity-100" : done ? "opacity-60" : "opacity-30"
            )}
          >
            <span className="flex items-center gap-1.5">
              <span
                className={cn(
                  "flex size-4 items-center justify-center rounded-full text-[9px] font-medium tabular-nums",
                  done
                    ? "bg-primary text-primary-foreground"
                    : active
                      ? "border border-primary text-primary"
                      : "border border-current/40"
                )}
              >
                {done ? <CheckIcon className="size-2.5" weight="bold" /> : i + 1}
              </span>
              <span className={cn(active && "font-medium", !active && "hidden sm:inline")}>{label}</span>
            </span>
            {i < STEPS.length - 1 ? <span aria-hidden className="h-px w-3 bg-current/25 sm:w-6" /> : null}
          </li>
        )
      })}
    </ol>
  )
}
