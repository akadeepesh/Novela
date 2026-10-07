"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import {
  ArrowLeftIcon,
  CaretLeftIcon,
  CaretRightIcon,
  ListBulletsIcon,
} from "@phosphor-icons/react/dist/ssr"
import { cn } from "cn"
import { getBackgroundPreset, type ManuscriptSettings } from "@/lib/manuscript-config"
import { getTrimSize } from "@/lib/export-config"
import type { ExportBlock, ExportDocument } from "@/lib/export/document-model"
import type { ProjectType } from "@/lib/project-config"
import { blocksToHtml, escapeHtml } from "./blocks-html"
import { paginateBlocks } from "./paginate"

// react-pageflip reaches for `window` at import time, so it only ever
// loads in the browser.
const HTMLFlipBook = dynamic(() => import("react-pageflip"), { ssr: false })

// Its published types don't model the children/ref contract precisely
// enough for strict mode, and how far off varies by the version npm
// resolves — cast once here.
const FlipBook = HTMLFlipBook as unknown as React.ComponentType<Record<string, unknown>>

type FlipBookHandle = {
  pageFlip: () => {
    flipNext: () => void
    flipPrev: () => void
    flip: (page: number) => void
    getCurrentPageIndex: () => number
  }
}

/**
 * The whole book is laid out at the export's own page size, in points
 * (1 pt = 1 CSS px here), with the exporter's own typography and margins
 * (see lib/export/render-pdf.tsx). Pagination happens once at that
 * reference size; the window size only decides how much each page is
 * scaled up or down to fit. So page breaks, page counts, and page numbers
 * never change when you resize — and they line up with the PDF.
 */
const POINTS_PER_INCH = 72

type Leaf =
  | { kind: "cover-front" }
  | { kind: "cover-back" }
  | { kind: "blank" }
  | { kind: "title" }
  | {
      kind: "section"
      blocks: ExportBlock[]
      openerHtml: string | null
      toc: boolean
      running: boolean
    }

type Book = {
  leaves: Leaf[]
  /** Contents-menu entries: where each chapter begins. */
  sections: { id: string; label: string; leaf: number }[]
}

type Dims = {
  pageW: number
  pageH: number
  contentW: number
  contentH: number
  marginTop: number
  marginX: number
}

function measure(el: HTMLElement, html: string): number {
  el.innerHTML = html
  return el.scrollHeight
}

function buildBook(doc: ExportDocument, el: HTMLElement, d: Dims): Book {
  const leaves: Leaf[] = [{ kind: "cover-front" }, { kind: "blank" }] // blank = inside-cover endpaper
  const sections: Book["sections"] = []

  if (doc.includeTitlePage) leaves.push({ kind: "title" })

  function addSection(
    blocks: ExportBlock[],
    openerHtml: string,
    opts: { toc: boolean; running: boolean; id?: string; label?: string }
  ) {
    if (opts.toc) el.setAttribute("data-toc", "")
    else el.removeAttribute("data-toc")

    const openerH = measure(el, openerHtml)
    const pages = paginateBlocks(blocks, el, d.contentH, {
      keepBlocksTogether: doc.isPoetry,
      firstPageHeightPx: Math.max(d.contentH - openerH, 0),
    })
    if (opts.id) sections.push({ id: opts.id, label: opts.label ?? "", leaf: leaves.length })
    pages.forEach((pageBlocks, i) => {
      leaves.push({
        kind: "section",
        blocks: pageBlocks,
        openerHtml: i === 0 ? openerHtml : null,
        toc: opts.toc,
        running: opts.running,
      })
    })
  }

  if (doc.includeTOC && doc.manuscript.length > 0) {
    const entries: ExportBlock[] = doc.manuscript.map((s) => ({
      kind: "paragraph",
      runs: [{ text: (s.numberLabel ? `${s.numberLabel}  ·  ` : "") + s.title, marks: [] }],
    }))
    addSection(entries, "<h1>Contents</h1>", { toc: true, running: false })
  }

  for (const s of doc.manuscript) {
    const opener =
      (s.numberLabel ? `<div class="sec-num">${escapeHtml(s.numberLabel.toUpperCase())}</div>` : "") +
      `<div class="sec-title">${escapeHtml(s.title)}</div>`
    addSection(s.blocks, opener, {
      toc: false,
      running: true,
      id: s.id,
      label: s.numberLabel ? `${s.numberLabel} · ${s.title}` : s.title,
    })
  }

  // Interior (everything between the covers) must be an even number of
  // leaves so the back cover lands alone on the last page, like a real book.
  if ((leaves.length - 1) % 2 !== 0) leaves.push({ kind: "blank" })
  leaves.push({ kind: "cover-back" })

  el.removeAttribute("data-toc")
  el.innerHTML = ""
  return { leaves, sections }
}

const BOOK_CSS = `
.book-text{font-family:"Times New Roman",Times,"Liberation Serif",serif;font-size:11.5px;display:flex;flex-direction:column}
.book-text>*{flex:none}
.book-text p{margin:0 0 10px;line-height:1.5}
.book-text[data-toc] p{margin:0 0 6px;line-height:1.5}
.book-text h1{font-size:18px;font-weight:700;margin:4px 0 18px;line-height:1.25}
.book-text h2{font-size:14px;font-weight:700;margin:16px 0 8px;line-height:1.25}
.book-text h3{font-size:12px;font-weight:700;margin:12px 0 6px;line-height:1.25}
.book-text blockquote{margin:8px 18px;font-style:italic;line-height:1.5}
.book-text strong{font-weight:700}.book-text em{font-style:italic}
.book-text .sec-num{font-size:11px;text-align:center;opacity:.6;letter-spacing:1px;margin-bottom:4px}
.book-text .sec-title{font-size:18px;font-weight:700;text-align:center;margin:4px 0 18px;line-height:1.25}
`

export function ReadView({
  doc,
  projectType,
  manuscriptSettings: settings,
  coverFrontUrl,
  coverBackUrl,
  initialChapterId,
  backHref,
}: {
  doc: ExportDocument
  projectType: ProjectType
  manuscriptSettings: ManuscriptSettings
  coverFrontUrl?: string
  coverBackUrl?: string
  initialChapterId?: string
  backHref: string
}) {
  const trim = getTrimSize(doc.trimSize)
  const W0 = trim.widthIn * POINTS_PER_INCH
  const H0 = trim.heightIn * POINTS_PER_INCH

  const dims = useMemo<Dims>(() => {
    const marginX = trim.marginIn.horizontal * POINTS_PER_INCH
    const marginTop = trim.marginIn.top * POINTS_PER_INCH
    const marginBottom = trim.marginIn.bottom * POINTS_PER_INCH
    return {
      pageW: W0,
      pageH: H0,
      marginX,
      marginTop,
      contentW: W0 - marginX * 2,
      contentH: H0 - marginTop - marginBottom,
    }
  }, [trim, W0, H0])

  const bg = getBackgroundPreset(settings.background, settings.backgroundImageUrl)
  const paperStyle = { ...bg.style, width: W0, height: H0 }

  const areaRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLDivElement>(null)
  const bookRef = useRef<FlipBookHandle | null>(null)
  // Latest page the reader is on. Written by the flip handler and read only
  // inside effects/callbacks (never during render), so a re-layout or rebuild
  // can put the reader back where they were.
  const currentRef = useRef(0)

  const [layout, setLayout] = useState<{ w: number; h: number; spread: boolean } | null>(null)
  const [book, setBook] = useState<Book | null>(null)
  const [pageIndex, setPageIndex] = useState(0)
  // Page the flipbook opens on. Changes only when the layout or book is rebuilt.
  const [startPage, setStartPage] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)

  // Same [data-genre] hook project-shell.tsx sets, so the generated
  // covers pick up the per-type --primary colour. Read View sits outside
  // the project layout, so nothing else would set it.
  useEffect(() => {
    document.documentElement.setAttribute("data-genre", projectType)
    return () => document.documentElement.removeAttribute("data-genre")
  }, [projectType])

  // Chooses page size: a two-page spread when the window is wide enough
  // for two readable pages, otherwise a single page.
  useEffect(() => {
    const el = areaRef.current
    if (!el) return
    const ratio = W0 / H0
    let timer: ReturnType<typeof setTimeout> | null = null

    const resize = () => {
      const rect = el.getBoundingClientRect()
      const availW = rect.width - 32
      const availH = rect.height - 32
      const spreadH = Math.min(availH, availW / 2 / ratio, 1100)
      // The flipbook remounts at the new size; reopen it on the current page.
      setStartPage(currentRef.current)
      if (spreadH * ratio >= 300) {
        setLayout({ w: Math.round(spreadH * ratio), h: Math.round(spreadH), spread: true })
      } else {
        const h = Math.min(availH, availW / ratio, 1100)
        setLayout({ w: Math.round(h * ratio), h: Math.round(h), spread: false })
      }
    }

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
  }, [W0, H0])

  // Paginates the whole book once, at the reference page size.
  useEffect(() => {
    let cancelled = false
    const run = () => {
      const el = measureRef.current
      if (cancelled || !el) return
      const built = buildBook(doc, el, dims)
      setBook(built)
      if (currentRef.current > 0) {
        setStartPage(currentRef.current)
      } else {
        const section = built.sections.find((x) => x.id === initialChapterId)
        setStartPage(section ? section.leaf : 0)
      }
    }
    const ready = document.fonts?.ready ?? Promise.resolve()
    ready.then(() => requestAnimationFrame(run))
    return () => {
      cancelled = true
    }
  }, [doc, dims, initialChapterId])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") bookRef.current?.pageFlip().flipPrev()
      else if (e.key === "ArrowRight") bookRef.current?.pageFlip().flipNext()
      else if (e.key === "Escape") setMenuOpen(false)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  const k = layout ? layout.w / W0 : 1
  const total = book?.leaves.length ?? 0

  function pageLabel(i: number): string {
    if (!book) return ""
    if (i <= 0) return "Front cover"
    if (i >= total - 1) return "Back cover"
    if (i === 1) return ""
    return `Page ${i - 1}`
  }

  function renderLeaf(leaf: Leaf, i: number) {
    const hard = leaf.kind === "cover-front" || leaf.kind === "cover-back"
    // Interior pages are numbered like the PDF: the title page is page 1.
    const pageNumber = i - 1

    let content: React.ReactNode = null

    if (leaf.kind === "cover-front" || leaf.kind === "cover-back") {
      const url = leaf.kind === "cover-front" ? coverFrontUrl : coverBackUrl
      if (url) {
        content = (
          <div
            style={{
              width: W0,
              height: H0,
              backgroundImage: `url(${url})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
        )
      } else if (leaf.kind === "cover-front") {
        content = (
          <div
            className="flex flex-col items-center justify-center bg-primary text-center text-primary-foreground"
            style={{ width: W0, height: H0, padding: 22 }}
          >
            <div
              className="flex size-full flex-col items-center justify-center border border-current/40"
              style={{ padding: 28 }}
            >
              <p style={{ fontFamily: '"Times New Roman",Times,serif', fontSize: 34, fontWeight: 700, lineHeight: 1.15 }}>
                {doc.title}
              </p>
              <div className="my-5 h-px w-12 bg-current opacity-50" />
              {doc.authorName ? (
                <p style={{ fontSize: 13, letterSpacing: 3, textTransform: "uppercase", opacity: 0.85 }}>
                  {doc.authorName}
                </p>
              ) : null}
            </div>
          </div>
        )
      } else {
        content = (
          <div
            className="flex flex-col items-center justify-center bg-primary text-center text-primary-foreground"
            style={{ width: W0, height: H0, padding: 22 }}
          >
            <div
              className="flex size-full flex-col items-center justify-center border border-current/40"
              style={{ padding: 34 }}
            >
              {doc.backCoverBlurb ? (
                <p
                  style={{
                    fontFamily: '"Times New Roman",Times,serif',
                    fontSize: 13,
                    lineHeight: 1.6,
                    fontStyle: "italic",
                    whiteSpace: "pre-line",
                  }}
                >
                  {doc.backCoverBlurb}
                </p>
              ) : (
                <p style={{ fontSize: 12, letterSpacing: 3, textTransform: "uppercase", opacity: 0.8 }}>
                  {doc.title}
                </p>
              )}
            </div>
          </div>
        )
      }
    } else if (leaf.kind === "blank") {
      content = <div style={paperStyle} />
    } else if (leaf.kind === "title") {
      content = (
        <div className="book-text" style={paperStyle}>
          <div className="flex size-full flex-col items-center justify-center text-center" style={{ padding: `${dims.marginTop}px ${dims.marginX}px` }}>
            <p style={{ fontSize: 26, fontWeight: 700, marginBottom: 16 }}>{doc.title}</p>
            {doc.authorName ? <p style={{ fontSize: 14 }}>{doc.authorName}</p> : null}
          </div>
        </div>
      )
    } else {
      content = (
        <div style={{ ...paperStyle, position: "relative" }}>
          {leaf.running && doc.headerText ? (
            <p
              className="book-text"
              style={{ position: "absolute", top: 28, left: dims.marginX, right: dims.marginX, fontSize: 9, textAlign: "center", opacity: 0.6 }}
            >
              {doc.headerText}
            </p>
          ) : null}
          <div
            className="book-text"
            data-toc={leaf.toc ? "" : undefined}
            style={{ position: "absolute", top: dims.marginTop, left: dims.marginX, width: dims.contentW, height: dims.contentH, overflow: "hidden" }}
            dangerouslySetInnerHTML={{ __html: (leaf.openerHtml ?? "") + blocksToHtml(leaf.blocks) }}
          />
          {leaf.running ? (
            <p
              className="book-text"
              style={{ position: "absolute", bottom: 24, left: dims.marginX, right: dims.marginX, fontSize: 9, textAlign: "center", opacity: 0.6, whiteSpace: "pre" }}
            >
              {doc.footerText ? `${doc.footerText}   ·   ${pageNumber}` : pageNumber}
            </p>
          ) : null}
        </div>
      )
    }

    return (
      <div key={i} className="page" data-density={hard ? "hard" : "soft"} style={{ width: "100%", height: "100%", overflow: "hidden" }}>
        <div style={{ width: W0, height: H0, transform: `scale(${k})`, transformOrigin: "0 0" }}>{content}</div>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col bg-muted/40">
      <style>{BOOK_CSS}</style>

      <div className="relative flex items-center justify-between border-b border-border bg-background px-4 py-2">
        <Link href={backHref} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeftIcon className="size-3.5" />
          Back
        </Link>

        <div className="flex items-center gap-3">
          <p className="max-w-64 truncate text-sm font-medium text-foreground">{doc.title}</p>
          {book && book.sections.length > 0 ? (
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ListBulletsIcon className="size-3.5" />
              Contents
            </button>
          ) : null}
        </div>

        <span className="w-28 text-right text-xs text-muted-foreground">
          {book ? pageLabel(pageIndex) : ""}
        </span>

        {menuOpen && book ? (
          <div className="absolute top-full left-1/2 z-50 mt-1 max-h-80 w-72 -translate-x-1/2 overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-lg">
            {book.sections.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  bookRef.current?.pageFlip().flip(s.leaf)
                  setMenuOpen(false)
                }}
                className="block w-full truncate rounded-md px-3 py-1.5 text-left text-sm text-popover-foreground hover:bg-muted"
              >
                {s.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div ref={areaRef} className="relative flex flex-1 items-center justify-center gap-2 overflow-hidden p-4">
        {/* Off-screen measuring node — same width/typography as a real
            page's text area, never shown. */}
        <div
          ref={measureRef}
          aria-hidden
          className="book-text pointer-events-none"
          style={{ position: "fixed", top: 0, left: 0, visibility: "hidden", width: dims.contentW }}
        />

        {!book || !layout ? (
          <p className="text-sm text-muted-foreground">Preparing your book…</p>
        ) : (
          <>
            <button
              type="button"
              onClick={() => bookRef.current?.pageFlip().flipPrev()}
              aria-label="Previous page"
              className="hidden shrink-0 rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground sm:block"
            >
              <CaretLeftIcon className="size-5" />
            </button>

            <div style={{ width: layout.spread ? layout.w * 2 : layout.w, height: layout.h }} className={cn("shrink-0")}>
              <FlipBook
                key={`${layout.w}x${layout.h}-${layout.spread}`}
                ref={bookRef}
                width={layout.w}
                height={layout.h}
                size="fixed"
                minWidth={layout.w}
                maxWidth={layout.w}
                minHeight={layout.h}
                maxHeight={layout.h}
                startPage={startPage}
                showCover={true}
                usePortrait={true}
                mobileScrollSupport={true}
                drawShadow={true}
                maxShadowOpacity={0.45}
                flippingTime={700}
                onFlip={(e: { data: number }) => {
                  currentRef.current = e.data
                  setPageIndex(e.data)
                }}
              >
                {book.leaves.map((leaf, i) => renderLeaf(leaf, i))}
              </FlipBook>
            </div>

            <button
              type="button"
              onClick={() => bookRef.current?.pageFlip().flipNext()}
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
