"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { ArrowLeftIcon, CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react/dist/ssr"
import { cn } from "cn"
import { getBackgroundPreset, LINE_WIDTH_PX, type ManuscriptSettings } from "@/lib/manuscript-config"
import type { ExportBlock } from "@/lib/export/document-model"
import type { ProjectType } from "@/lib/project-config"
import { blocksToHtml } from "./blocks-html"
import { paginateBlocks } from "./paginate"

// react-pageflip reaches for `window` at module scope, so it can only ever
// run in the browser — loaded dynamically with SSR off rather than as a
// normal import.
const HTMLFlipBook = dynamic(() => import("react-pageflip"), { ssr: false })

// Its published types don't model the children/ref contract precisely
// enough for strict mode, and exactly how far off varies by the version
// npm resolves — cast once here rather than relying on a line-specific
// @ts-ignore that could itself go stale.
const FlipBook = HTMLFlipBook as unknown as React.ComponentType<Record<string, unknown>>

// Fixed pixel budget for a page's own chrome (padding + optional running
// header/footer). Kept as plain constants, not Tailwind classes, so the
// same numbers drive both the inline styles below and the height math fed
// into paginateBlocks — a mismatch between the two would silently produce
// pages that either overflow or leave the bottom half empty.
const PAGE_PADDING_X = 40
const PAGE_PADDING_TOP = 56
const PAGE_PADDING_BOTTOM = 40
const HEADER_RESERVE = 32
const FOOTER_RESERVE = 32

const MIN_PAGE_WIDTH = 320
const MAX_PAGE_WIDTH = 720
const MIN_PAGE_HEIGHT = 420
const MAX_PAGE_HEIGHT = 900

const ROOT_FONT_PX = 16 // matches globals.css — no custom html { font-size }

type FlipBookHandle = {
  pageFlip: () => {
    flipNext: () => void
    flipPrev: () => void
    getCurrentPageIndex: () => number
  }
}

export function ReadView({
  projectId,
  chapterId,
  title,
  numberLabel,
  chapterLabelSingular,
  blocks,
  manuscriptSettings: settings,
  projectType,
}: {
  projectId: string
  chapterId: string
  title: string
  numberLabel?: string
  chapterLabelSingular: string
  blocks: ExportBlock[]
  manuscriptSettings: ManuscriptSettings
  projectType: ProjectType
}) {
  const backHref = `/projects/${projectId}/chapters/${chapterId}`
  const bg = getBackgroundPreset(settings.background, settings.backgroundImageUrl, settings.backgroundVeil)
  const isPoetry = projectType === "poetry"

  const areaRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLDivElement>(null)
  const bookRef = useRef<FlipBookHandle | null>(null)

  const [box, setBox] = useState<{ w: number; h: number } | null>(null)
  const [pages, setPages] = useState<ExportBlock[][] | null>(null)
  const [pageIndex, setPageIndex] = useState(0)

  // Sets the same [data-genre] hook project-shell.tsx uses on every other
  // project page, so the per-type theme table in globals.css (heading
  // weight, poetry line-height, etc.) still applies here — Read View lives
  // outside the project layout entirely, so nothing else would set it.
  useEffect(() => {
    document.documentElement.setAttribute("data-genre", projectType)
    return () => document.documentElement.removeAttribute("data-genre")
  }, [projectType])

  // Measures the reading area and picks a page size — a comfortable
  // single reading column, capped well short of "wide enough for a
  // two-page spread" so react-pageflip stays in single-page portrait mode
  // regardless of viewport width.
  useEffect(() => {
    const el = areaRef.current
    if (!el) return

    let timer: ReturnType<typeof setTimeout> | null = null
    const resize = () => {
      const rect = el.getBoundingClientRect()
      const remWidth = parseFloat(LINE_WIDTH_PX[settings.lineWidth]) || 46
      const targetW = Math.min(remWidth * ROOT_FONT_PX, MAX_PAGE_WIDTH)
      const w = Math.round(Math.min(targetW, Math.max(MIN_PAGE_WIDTH, rect.width - 32)))
      const h = Math.round(
        Math.min(MAX_PAGE_HEIGHT, Math.max(MIN_PAGE_HEIGHT, rect.height - 32))
      )
      setBox((prev) => (prev && prev.w === w && prev.h === h ? prev : { w, h }))
    }

    // ResizeObserver fires once as soon as observe() starts, so the first
    // measurement lands immediately; later resizes are debounced. (State is
    // only ever set from this callback, never synchronously in the effect.)
    let first = true
    const observer = new ResizeObserver(() => {
      if (timer) clearTimeout(timer)
      if (first) {
        first = false
        resize()
        return
      }
      timer = setTimeout(resize, 150)
    })
    observer.observe(el)

    return () => {
      observer.disconnect()
      if (timer) clearTimeout(timer)
    }
  }, [settings.lineWidth])

  const contentWidth = box ? box.w - PAGE_PADDING_X * 2 : 0
  const contentHeight = box
    ? box.h -
      PAGE_PADDING_TOP -
      PAGE_PADDING_BOTTOM -
      (settings.showHeader ? HEADER_RESERVE : 0) -
      FOOTER_RESERVE
    : 0

  // Recomputes pagination whenever the page box or typography changes.
  // measureRef points at the inner .ProseMirror div specifically (not its
  // .manuscript-prose wrapper) — paginate.ts overwrites its innerHTML on
  // every trial measurement, and the heading/blockquote/poetry CSS rules
  // in globals.css are scoped to ".manuscript-prose .ProseMirror ___", so
  // that ancestor chain has to survive every measurement, not just the
  // first one. Width/font-size/line-height are set declaratively on the
  // wrapper below instead of imperatively here, so they can't drift out
  // of sync with what real pages render with.
  useEffect(() => {
    const measureEl = measureRef.current
    if (!measureEl || !box || contentWidth <= 0 || contentHeight <= 0) return

    // Deferred a frame so the wrapper's new width/font styles have been
    // applied before measuring, and so state is set from a callback rather
    // than synchronously inside the effect.
    const frame = requestAnimationFrame(() => {
      setPages(paginateBlocks(blocks, measureEl, contentHeight, { keepBlocksTogether: isPoetry }))
      setPageIndex(0)
    })
    return () => cancelAnimationFrame(frame)
  }, [blocks, box, contentWidth, contentHeight, isPoetry, settings.fontSize, settings.lineHeight])

  const proseClassName = cn("manuscript-prose", isPoetry && "is-poetry")

  const totalLeaves = (pages?.length ?? 0) + 2 // + title page + closing page

  function goPrev() {
    bookRef.current?.pageFlip().flipPrev()
  }
  function goNext() {
    bookRef.current?.pageFlip().flipNext()
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") bookRef.current?.pageFlip().flipPrev()
      else if (e.key === "ArrowRight") bookRef.current?.pageFlip().flipNext()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  const pageStyle = useMemo(
    () => ({
      ...bg.style,
      width: "100%",
      height: "100%",
      padding: `${PAGE_PADDING_TOP}px ${PAGE_PADDING_X}px ${PAGE_PADDING_BOTTOM}px`,
    }),
    [bg.style]
  )

  return (
    <div className="flex h-screen flex-col bg-background">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon className="size-3.5" />
          Back to editor
        </Link>

        <p className="truncate text-sm font-medium text-foreground">{title}</p>

        <span className="w-24 text-right text-xs text-muted-foreground">
          {pages ? `${Math.min(pageIndex + 1, totalLeaves)} / ${totalLeaves}` : ""}
        </span>
      </div>

      <div ref={areaRef} className="relative flex flex-1 items-center justify-center gap-2 overflow-hidden p-4">
        {/* Off-screen measuring node — identical typography classes/width
            to a real page's content area, but never shown. paginate.ts
            writes candidate HTML into it and reads scrollHeight back. */}
        <div
          aria-hidden
          className={cn(proseClassName, "pointer-events-none fixed top-0 left-0 -z-50 opacity-0")}
          style={{
            position: "fixed",
            visibility: "hidden",
            width: contentWidth > 0 ? `${contentWidth}px` : undefined,
            fontSize: settings.fontSize,
            lineHeight: settings.lineHeight,
          }}
        >
          <div ref={measureRef} className="ProseMirror" style={{ minHeight: 0 }} />
        </div>

        {!pages || !box ? (
          <p className="text-sm text-muted-foreground">Preparing pages…</p>
        ) : (
          <>
            <button
              type="button"
              onClick={goPrev}
              aria-label="Previous page"
              className="hidden shrink-0 rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground sm:block"
            >
              <CaretLeftIcon className="size-5" />
            </button>

            <FlipBook
              ref={bookRef}
              width={box.w}
              height={box.h}
              size="fixed"
              minWidth={MIN_PAGE_WIDTH}
              maxWidth={MAX_PAGE_WIDTH}
              minHeight={MIN_PAGE_HEIGHT}
              maxHeight={MAX_PAGE_HEIGHT}
              showCover={false}
              usePortrait={true}
              mobileScrollSupport={true}
              drawShadow={true}
              flippingTime={600}
              className="shadow-2xl"
              onFlip={(e: { data: number }) => setPageIndex(e.data)}
            >
              <div className="page" style={pageStyle}>
                <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                  {numberLabel ? (
                    <p className="text-xs tracking-widest uppercase opacity-60">
                      {numberLabel}
                    </p>
                  ) : null}
                  <h1 className="font-heading text-2xl font-semibold">{title}</h1>
                </div>
              </div>

              {pages.map((pageBlocks, i) => (
                <div className="page" style={pageStyle} key={i}>
                  <div className="flex h-full flex-col">
                    {settings.showHeader ? (
                      <p
                        className="text-center text-[11px] tracking-widest uppercase opacity-50"
                        style={{ height: HEADER_RESERVE }}
                      >
                        {settings.headerText || title}
                      </p>
                    ) : null}

                    <div
                      className={proseClassName}
                      style={{
                        fontSize: settings.fontSize,
                        lineHeight: settings.lineHeight,
                        height: contentHeight,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        className="ProseMirror"
                        style={{ minHeight: 0 }}
                        dangerouslySetInnerHTML={{ __html: blocksToHtml(pageBlocks) }}
                      />
                    </div>

                    <div
                      className="mt-auto flex items-center justify-center pt-3 text-[11px] opacity-50"
                      style={{ height: FOOTER_RESERVE }}
                    >
                      {settings.showFooter && settings.footerText ? (
                        <span>
                          {settings.footerText} · {i + 1}
                        </span>
                      ) : (
                        <span>{i + 1}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              <div className="page" style={pageStyle}>
                <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                  <p className="text-xs tracking-widest uppercase opacity-50">
                    End of {chapterLabelSingular.toLowerCase()}
                  </p>
                  <Link
                    href={backHref}
                    className="text-sm underline decoration-current/40 underline-offset-4 opacity-80 hover:opacity-100"
                  >
                    Back to editor
                  </Link>
                </div>
              </div>
            </FlipBook>

            <button
              type="button"
              onClick={goNext}
              aria-label="Next page"
              className="hidden shrink-0 rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground sm:block"
            >
              <CaretRightIcon className="size-5" />
            </button>
          </>
        )}
      </div>
    </div>
  )
}
