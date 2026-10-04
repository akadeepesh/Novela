"use client"

import { useState } from "react"
import { CheckCircleIcon, CheckIcon, ImageSquareIcon, LinkSimpleIcon, PaintBrushIcon, WarningIcon } from "@phosphor-icons/react/dist/ssr"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { BACKGROUND_PRESETS } from "@/lib/manuscript-config"
import { previewBlocks } from "@/lib/import/review/doc-ops"
import type { ReviewAction } from "@/lib/import/review/state"
import { needsLook, type BackgroundChoice, type BackgroundInfo, type PresetId, type ReviewPiece } from "@/lib/import/review/types"
import { PageSheet, type SheetBackground } from "./page-sheet"
import { TouchUp } from "./touch-up"

type Dispatch = (action: ReviewAction) => void

/* ───────────────────────────── the piece ───────────────────────────── */

export function PiecePanel({
  piece,
  index,
  total,
  prevId,
  sheet,
  dispatch,
  noun,
}: {
  piece: ReviewPiece
  index: number
  total: number
  /** The piece before this one (for "Join with previous"), if any. */
  prevId: string | null
  sheet: SheetBackground
  dispatch: Dispatch
  noun: string
}) {
  const look = needsLook(piece)
  const blocks = previewBlocks(piece.doc)

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <p className="text-xs tracking-wide uppercase opacity-50">
          {noun} {index + 1} of {total} · {piece.startPage === piece.endPage ? `page ${piece.startPage}` : `pages ${piece.startPage}–${piece.endPage}`} ·{" "}
          {piece.wordCount.toLocaleString("en-US")} words
        </p>
        <input
          key={piece.id + piece.title}
          defaultValue={piece.title}
          aria-label={`Title of this ${noun}`}
          onBlur={(e) => {
            const v = e.currentTarget.value.trim()
            if (v && v !== piece.title) dispatch({ type: "rename", id: piece.id, title: v })
            else e.currentTarget.value = piece.title
          }}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          className="-mx-2 w-[calc(100%+1rem)] rounded-md bg-transparent px-2 py-1 font-serif text-2xl leading-tight outline-none transition-colors hover:bg-current/5 focus:bg-background focus:ring-2 focus:ring-ring/60"
        />
        {piece.titleSource === "first-line" ? (
          <p className="text-xs opacity-50">Named after its first line. Change it any time.</p>
        ) : null}
      </div>

      {look ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-500/35 bg-amber-500/10 p-4 text-sm leading-relaxed">
          <div className="flex items-start gap-2.5">
            <WarningIcon className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-300" weight="fill" />
            <ul className="flex flex-col gap-1">
              {piece.flags.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {!piece.checked && piece.flags.length > 0 ? (
          <Button size="sm" onClick={() => dispatch({ type: "check", id: piece.id, checked: true })}>
            <CheckIcon /> Looks right
          </Button>
        ) : null}
        <JoinButtons piece={piece} prevId={prevId} isLast={index === total - 1} dispatch={dispatch} noun={noun} />
      </div>

      <div className="flex flex-col gap-3">
        <PageSheet
          blocks={blocks}
          background={sheet}
          splittable={piece.layout === "verse" ? "lines" : "blocks"}
          onSplit={(at) => dispatch({ type: "split", id: piece.id, at })}
        />
        <p className="text-center text-xs leading-relaxed opacity-55">
          {piece.layout === "verse"
            ? `Hover between two lines and choose “Split here” to cut this ${noun} in two.`
            : `Hover between two paragraphs and choose “Split here” to cut this ${noun} in two.`}
        </p>
      </div>
    </div>
  )
}

function JoinButtons({ piece, prevId, isLast, dispatch, noun }: { piece: ReviewPiece; prevId: string | null; isLast: boolean; dispatch: Dispatch; noun: string }) {
  return (
    <>
      <Button variant="outline" size="sm" disabled={!prevId} onClick={() => prevId && dispatch({ type: "merge", id: prevId })}>
        <LinkSimpleIcon /> Join with previous
      </Button>
      <Button variant="outline" size="sm" disabled={isLast} onClick={() => dispatch({ type: "merge", id: piece.id })}>
        <LinkSimpleIcon /> Join with next {noun}
      </Button>
    </>
  )
}

/* ─────────────────────────── the page design ─────────────────────────── */

export function DesignPanel({
  jobId,
  info,
  choice,
  version,
  sample,
  dispatch,
  onTouchedUp,
}: {
  jobId: string
  info: BackgroundInfo | null
  choice: BackgroundChoice
  version: number
  sample: ReviewPiece
  dispatch: Dispatch
  onTouchedUp: () => void
}) {
  const [touching, setTouching] = useState(false)
  const hasImage = !!info?.hasImage
  const dark = info?.flatColor.dark ?? false
  const url = `/api/import/${jobId}/asset/background?v=${version}`
  const sheet: SheetBackground = choice.kind === "image" && hasImage ? { kind: "image", url, dark } : { kind: "preset", id: choice.kind === "preset" ? choice.id : "cream" }
  const recommended = info?.recommendation === "use-image" ? "image" : "plain"
  const quality = info?.quality

  if (touching && hasImage) {
    return (
      <TouchUp
        jobId={jobId}
        version={version}
        touchedUp={info?.touchedUp ?? false}
        onSaved={() => onTouchedUp()}
        onClose={() => setTouching(false)}
      />
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageSheet blocks={previewBlocks(sample.doc)} background={sheet} />

      <div className="flex flex-col gap-3">
        <OptionCard
          selected={choice.kind === "image" && hasImage}
          disabled={!hasImage}
          onSelect={() => dispatch({ type: "background", choice: { kind: "image" } })}
          icon={<ImageSquareIcon className="size-5" weight="duotone" />}
          title="The design from your PDF"
          badge={recommended === "image" && hasImage ? "Recommended" : undefined}
          body={
            hasImage ? (
              <>
                <span>
                  {quality === "good" ? "Clean — the writing came off completely." : quality === "fair" ? "Usable, but have a look for faint traces of writing." : "Not clean enough to trust — a plain page may suit better."}
                </span>
                {info?.notes.slice(0, 2).map((n) => (
                  <span key={n} className="block pt-1 text-xs opacity-70">
                    {n}
                  </span>
                ))}
              </>
            ) : (
              "We couldn’t lift a design from this PDF, so a plain page is the way to go."
            )
          }
          footer={
            hasImage && choice.kind === "image" ? (
              <Button variant="outline" size="sm" onClick={() => setTouching(true)}>
                <PaintBrushIcon /> Touch up
              </Button>
            ) : null
          }
        />

        <OptionCard
          selected={choice.kind === "preset"}
          onSelect={() => dispatch({ type: "background", choice: { kind: "preset", id: dark ? "midnight" : "cream" } })}
          icon={<PaintBrushIcon className="size-5" weight="duotone" />}
          title="A plain page"
          badge={recommended === "plain" ? "Recommended" : undefined}
          body="A quiet colour from the book’s own palette. You can change it later in the book’s settings."
          footer={
            <div role="radiogroup" aria-label="Plain page colour" className="flex flex-wrap gap-2">
              {BACKGROUND_PRESETS.map((p) => {
                const on = choice.kind === "preset" && choice.id === p.id
                return (
                  <button
                    key={p.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    aria-label={p.label}
                    title={p.label}
                    onClick={(e) => {
                      e.stopPropagation()
                      dispatch({ type: "background", choice: { kind: "preset", id: p.id as PresetId } })
                    }}
                    className={cn(
                      "size-8 rounded-full border border-current/20 outline-none transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring",
                      on && "ring-2 ring-primary ring-offset-2 ring-offset-background"
                    )}
                    style={{ background: p.swatch }}
                  />
                )
              })}
            </div>
          }
        />
      </div>
    </div>
  )
}

function OptionCard({
  selected,
  disabled,
  onSelect,
  icon,
  title,
  badge,
  body,
  footer,
}: {
  selected: boolean
  disabled?: boolean
  onSelect: () => void
  icon: React.ReactNode
  title: string
  badge?: string
  body: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <div
      onClick={() => !disabled && onSelect()}
      className={cn(
        "flex flex-col gap-3 rounded-2xl border p-4 transition-colors",
        disabled ? "opacity-60" : "cursor-pointer",
        selected ? "border-primary/50 bg-card ring-1 ring-primary/25" : "border-current/12 bg-card/50 hover:border-current/25"
      )}
    >
      <div className="flex items-start gap-3">
        <span className={cn("mt-0.5", selected ? "text-primary" : "opacity-60")}>{icon}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={disabled}
              onClick={(e) => {
                e.stopPropagation()
                onSelect()
              }}
              aria-pressed={selected}
              className="font-serif text-lg leading-tight outline-none focus-visible:underline"
            >
              {title}
            </button>
            {badge ? <span className="rounded-full bg-primary/12 px-2 py-0.5 text-[11px] font-medium text-primary">{badge}</span> : null}
          </div>
          <div className="mt-1 text-sm leading-relaxed opacity-70">{body}</div>
        </div>
        {selected ? <CheckCircleIcon className="size-5 shrink-0 text-primary" weight="fill" /> : null}
      </div>
      {footer ? <div onClick={(e) => e.stopPropagation()}>{footer}</div> : null}
    </div>
  )
}

/* ─────────────────────────────── the cover ─────────────────────────────── */

export function CoverPanel({
  jobId,
  hasCover,
  useCover,
  hadCoverAnswer,
  dispatch,
}: {
  jobId: string
  hasCover: boolean
  useCover: boolean
  /** The person said page 1 is a cover (Step 2) — so a missing picture means it couldn't be drawn, not that there isn't one. */
  hadCoverAnswer: boolean
  dispatch: Dispatch
}) {
  if (!hasCover) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-current/20 p-8 text-center">
        <ImageSquareIcon className="size-8 opacity-40" weight="duotone" />
        <p className="font-serif text-lg">{hadCoverAnswer ? "The cover couldn’t be drawn" : "No cover in the PDF"}</p>
        <p className="max-w-xs text-sm leading-relaxed opacity-65">
          Your book will open with a typeset cover — its title and your name, set in the book’s own type. You can add cover art any time from the book’s overview page.
        </p>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-6">
      <div
        className={cn(
          "relative mx-auto aspect-[2/3] w-full max-w-[300px] overflow-hidden rounded-md border border-current/15 shadow-[0_24px_40px_-24px_rgb(0_0_0/0.55)] transition-opacity",
          !useCover && "opacity-35"
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/api/import/${jobId}/asset/cover`} alt="Page 1 of your PDF, drawn as the front cover" className="size-full object-cover" />
      </div>
      {/* Switch is only a visual indicator in this app — the button around it carries the click and the semantics. */}
      <button
        type="button"
        role="switch"
        aria-checked={useCover}
        onClick={() => dispatch({ type: "cover", use: !useCover })}
        className="flex items-start gap-3 rounded-2xl border border-current/12 bg-card/50 p-4 text-left outline-none transition-colors hover:border-current/25 focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="mt-0.5">
          <Switch checked={useCover} />
        </span>
        <span className="flex flex-col gap-0.5">
          <span className="font-serif text-lg leading-tight">Use page 1 as the front cover</span>
          <span className="text-sm leading-relaxed opacity-65">
            {useCover ? "It becomes your book’s front cover exactly as it looks here." : "Off — your book will open with a typeset cover instead."}
          </span>
        </span>
      </button>
    </div>
  )
}
