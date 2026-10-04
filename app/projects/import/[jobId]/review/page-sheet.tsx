"use client"

import { ScissorsIcon } from "@phosphor-icons/react/dist/ssr"
import { cn } from "cn"
import { BACKGROUND_PRESETS } from "@/lib/manuscript-config"
import type { PreviewBlock, SplitPoint } from "@/lib/import/review/doc-ops"
import type { PresetId } from "@/lib/import/review/types"

const INK_LIGHT = "oklch(0.24 0.014 55)"
const INK_DARK = "oklch(0.92 0.006 75)"

export type SheetBackground =
  | { kind: "image"; url: string; dark: boolean }
  | { kind: "preset"; id: PresetId }

export function sheetStyle(bg: SheetBackground): React.CSSProperties {
  if (bg.kind === "image") {
    return {
      backgroundImage: `url(${bg.url})`,
      backgroundSize: "cover",
      backgroundPosition: "center",
      color: bg.dark ? INK_DARK : INK_LIGHT,
    }
  }
  const preset = BACKGROUND_PRESETS.find((p) => p.id === bg.id) ?? BACKGROUND_PRESETS[0]
  return preset.style as React.CSSProperties
}

/**
 * A page of the book, as it will read: the lifted (or chosen) background with
 * the piece's lines on it, centered the way the writer set them. With
 * `splittable` it also doubles as the cutting board — hover or tab between
 * two lines and a "Split here" mark appears.
 */
export function PageSheet({
  blocks,
  background,
  splittable = false,
  onSplit,
  className,
}: {
  blocks: PreviewBlock[]
  background: SheetBackground
  /** "lines": cut between any two lines (verse). "blocks": only between paragraphs (prose). */
  splittable?: false | "lines" | "blocks"
  onSplit?: (at: SplitPoint) => void
  className?: string
}) {
  return (
    <div
      className={cn(
        "relative mx-auto aspect-[2/3] w-full max-w-[400px] overflow-y-auto rounded-md border border-current/15 shadow-[0_24px_40px_-24px_rgb(0_0_0/0.5)]",
        className
      )}
      style={sheetStyle(background)}
    >
      <div className="flex min-h-full flex-col px-[13%] py-[15%]">
        <div className="my-auto font-serif text-[15px] leading-[1.75]">
          {blocks.map((block, bi) => (
            <div key={bi} className={cn(block.centered && "text-center", bi > 0 && "mt-5")}>
              {block.lines.map((line, li) => {
                const canSplit =
                  splittable && !(bi === 0 && li === 0) && (splittable === "lines" || li === 0)
                return (
                  <div key={li}>
                    {canSplit ? <SplitGap at={line.at} before={line.text} onSplit={onSplit} /> : null}
                    <p className={cn(block.kind === "heading" && "text-lg font-medium", "break-words")}>
                      {line.runs.map((run, ri) => (
                        <span key={ri} className={cn(run.bold && "font-semibold", run.italic && "italic")}>
                          {run.text}
                        </span>
                      ))}
                    </p>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function SplitGap({ at, before, onSplit }: { at: SplitPoint; before: string; onSplit?: (at: SplitPoint) => void }) {
  const preview = before.split(/\s+/).slice(0, 4).join(" ")
  return (
    <div className="group/gap relative h-0">
      <button
        type="button"
        onClick={() => onSplit?.(at)}
        aria-label={`Split here, before “${preview}…”`}
        className="absolute inset-x-[-6%] top-[-12px] z-10 flex h-6 cursor-pointer items-center justify-center outline-none"
      >
        <span className="h-px w-full border-t border-dashed border-transparent transition-colors group-hover/gap:border-primary/70 group-focus-within/gap:border-primary/70" />
        <span className="absolute right-1 flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 font-sans text-[11px] font-medium text-primary-foreground opacity-0 shadow transition-opacity group-hover/gap:opacity-100 group-focus-within/gap:opacity-100">
          <ScissorsIcon className="size-3" weight="bold" />
          Split here
        </span>
      </button>
    </div>
  )
}
