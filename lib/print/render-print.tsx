import { Fragment, type ReactNode } from "react"
import { Document, Font, Image, Page, Text, View, pdf } from "@react-pdf/renderer"
import { PDFDocument } from "pdf-lib"
import {
  type ExportBlock,
  type ExportDocument,
  type ExportMark,
  type ExportRun,
  type ExportSection,
} from "@/lib/export/document-model"
import { MAX_PAGES, MIN_PAGES, minimumGutterIn, pageGeometry, POINTS_PER_INCH, type PageGeometry, type Printer } from "./specs"
import type { FontFamilySpec, PrintTemplate } from "./template"

/**
 * The print-ready PDF: a book interior for Amazon KDP or IngramSpark.
 *
 * react-pdf lays out the pages; pdf-lib then shifts each page so the
 * gutter is on the spine side (mirrored margins) and sets the trim and
 * bleed boxes. Layout runs more than once: the gutter depends on the page
 * count, and the table of contents and right-hand chapter starts depend on
 * where chapters fall. Every font is a real file, so every glyph is
 * embedded, as printers require.
 */

export type CopyrightInfo = {
  /** The whole copyright page text. Blank lines separate paragraphs. */
  text: string
}

export type PrintOptions = {
  template: PrintTemplate
  trimSizeId: string
  printer: Printer
  bleed: boolean
  copyright?: CopyrightInfo
  /**
   * Turns a template file reference into something react-pdf can load: a
   * URL in the browser, a file path in tests.
   */
  resolveFile: (ref: string) => string
  /** Called between layout passes, so the page can show progress. */
  onProgress?: (step: string) => void
}

export type PrintReport = {
  pageCount: number
  geometry: PageGeometry
  /** Pages before chapter one (title, copyright, dedication, contents, padding). */
  frontPages: number
  /** Absolute page where each chapter or appendix starts. */
  starts: Map<string, number>
  /** Problems worth telling the writer about before they upload. */
  warnings: string[]
}

type Plan = {
  /** Pages before the first chapter, padded to an even count so chapter one is on a right-hand page. */
  frontPages: number
  /** Blank page before each section (by id), for right-hand starts. */
  blankBefore: Set<string>
  /** Absolute page where each section starts. */
  starts: Map<string, number>
  /** Whether a blank page was added to make the front matter an even number of pages. */
  padFront: boolean
  pageCount: number
}

// ---------------------------------------------------------------------------
// Fonts
// ---------------------------------------------------------------------------

const registered = new Set<string>()

function familyName(template: PrintTemplate, role: "body" | "heading"): string {
  const spec = template.fonts[role] ?? template.fonts.body
  return `${template.id}::${spec.family}`
}

function registerFonts(template: PrintTemplate, resolveFile: (ref: string) => string) {
  const specs: [string, FontFamilySpec][] = [[familyName(template, "body"), template.fonts.body]]
  if (template.fonts.heading) specs.push([familyName(template, "heading"), template.fonts.heading])
  for (const [family, spec] of specs) {
    const key = `${family}|${spec.regular}`
    if (registered.has(key)) continue
    const src = (ref: string | undefined) => resolveFile(ref ?? spec.regular)
    Font.register({
      family,
      fonts: [
        { src: src(spec.regular), fontWeight: 400, fontStyle: "normal" },
        { src: src(spec.italic), fontWeight: 400, fontStyle: "italic" },
        { src: src(spec.bold), fontWeight: 700, fontStyle: "normal" },
        { src: src(spec.boldItalic ?? spec.bold), fontWeight: 700, fontStyle: "italic" },
      ],
    })
    registered.add(key)
  }
}

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

function markStyle(marks: ExportMark[]) {
  return {
    fontWeight: marks.includes("bold") ? 700 : 400,
    fontStyle: marks.includes("italic") ? ("italic" as const) : ("normal" as const),
    textDecoration: marks.includes("underline") && marks.includes("strike")
      ? ("underline line-through" as const)
      : marks.includes("underline")
        ? ("underline" as const)
        : marks.includes("strike")
          ? ("line-through" as const)
          : undefined,
  }
}

/** Inline runs. `extra` goes on each run: react-pdf doesn't pass textIndent down to nested text. */
function Runs({ runs, extra }: { runs: ExportRun[]; extra?: { textIndent?: number } }) {
  return (
    <>
      {runs.map((run, i) =>
        "break" in run ? (
          <Text key={i} style={extra}>
            {"\n"}
          </Text>
        ) : (
          <Text key={i} style={{ ...markStyle(run.marks), ...extra }}>
            {run.text}
          </Text>
        )
      )}
    </>
  )
}

/**
 * The chapter's first paragraph, with its first words in capitals. (A large
 * initial letter isn't offered: react-pdf overlaps the first two lines when
 * one character in a line is much bigger than the rest.)
 */
function OpeningRuns({ runs, template }: { runs: ExportRun[]; template: PrintTemplate }) {
  const { leadInWords } = template.chapter
  const first = runs[0]
  if (!first || "break" in first || leadInWords === 0) return <Runs runs={runs} />
  const text = first.text.replace(/^\s+/, "")
  const words = text.match(new RegExp(`^(\\S+(?:\\s+\\S+){0,${Math.max(0, leadInWords - 1)}})`, "u"))?.[1] ?? ""
  return (
    <>
      <Text style={{ ...markStyle(first.marks), fontSize: template.body.fontSize * 0.86, letterSpacing: 0.8 }}>
        {words.toUpperCase()}
      </Text>
      <Text style={markStyle(first.marks)}>{text.slice(words.length)}</Text>
      <Runs runs={runs.slice(1)} />
    </>
  )
}

function SceneBreak({ template, resolveFile }: { template: PrintTemplate; resolveFile: (r: string) => string }) {
  const { image, widthIn, glyph } = template.sceneBreak
  const lh = template.body.fontSize * template.body.lineHeight
  if (image) {
    const w = (widthIn ?? 0.6) * POINTS_PER_INCH
    return (
      <View style={{ alignItems: "center", marginVertical: lh * 0.6 }} wrap={false}>
        {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt */}
        <Image src={resolveFile(image)} style={{ width: w }} />
      </View>
    )
  }
  return <Text style={{ textAlign: "center", marginVertical: lh * 0.5 }}>{glyph ?? "*  *  *"}</Text>
}

/**
 * Which paragraphs start flush left (the first one, and any after a
 * heading, scene break, list or quote), and which one opens the chapter.
 */
function paragraphLayout(blocks: ExportBlock[], opening: boolean): { noIndent: Set<number>; opening: number } {
  const noIndent = new Set<number>()
  let flush = true
  let first = -1
  blocks.forEach((block, i) => {
    if (block.kind !== "paragraph") {
      flush = true
      return
    }
    if (first < 0) first = i
    if (flush) noIndent.add(i)
    flush = false
  })
  return { noIndent, opening: opening ? first : -1 }
}

function Blocks({
  blocks,
  template,
  resolveFile,
  opening,
}: {
  blocks: ExportBlock[]
  template: PrintTemplate
  resolveFile: (r: string) => string
  /** True for a chapter's text: its first paragraph gets the opening treatment. */
  opening: boolean
}) {
  const b = template.body
  const indent = b.indent * b.fontSize
  const layout = paragraphLayout(blocks, opening)
  return (
    <>
      {blocks.map((block, i) => {
        if (block.kind === "sceneBreak") {
          return <SceneBreak key={i} template={template} resolveFile={resolveFile} />
        }
        if (block.kind === "heading") {
          const size = block.level === 1 ? b.fontSize * 1.35 : block.level === 2 ? b.fontSize * 1.15 : b.fontSize
          return (
            <Text key={i} style={{ fontSize: size, fontWeight: 700, marginTop: b.fontSize, marginBottom: b.fontSize * 0.5, textAlign: block.align ?? "left" }} minPresenceAhead={40}>
              <Runs runs={block.runs} />
            </Text>
          )
        }
        if (block.kind === "listItem") {
          return (
            <View key={i} style={{ flexDirection: "row", marginLeft: block.depth * 14, marginBottom: b.paragraphSpacing }} wrap={false}>
              <Text style={{ width: 14 }}>{block.ordered ? `${block.number}.` : "•"}</Text>
              <Text style={{ flex: 1 }}>
                <Runs runs={block.runs} />
              </Text>
            </View>
          )
        }
        if (block.kind === "blockquote") {
          return (
            <Text key={i} style={{ marginHorizontal: b.fontSize * 1.5, marginVertical: b.fontSize * 0.5, fontStyle: "italic" }}>
              <Runs runs={block.runs} />
            </Text>
          )
        }
        const isOpening = layout.opening === i
        const style = {
          textIndent: layout.noIndent.has(i) || block.align === "center" || block.align === "right" ? 0 : indent,
          textAlign: block.align ?? b.align,
          marginBottom: b.paragraphSpacing,
        }
        return (
          <Text key={i} style={style}>
            {isOpening ? <OpeningRuns runs={block.runs} template={template} /> : <Runs runs={block.runs} extra={{ textIndent: style.textIndent }} />}
          </Text>
        )
      })}
    </>
  )
}

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

type Ctx = {
  doc: ExportDocument
  template: PrintTemplate
  geometry: PageGeometry
  plan: Plan | null
  resolveFile: (r: string) => string
  /** Filled in during layout: the absolute page each section starts on. */
  measured: Map<string, number>
  copyright?: CopyrightInfo
}

function pageStyle(ctx: Ctx) {
  const t = ctx.template
  return {
    paddingTop: ctx.geometry.padding.top,
    paddingBottom: ctx.geometry.padding.bottom,
    paddingHorizontal: ctx.geometry.padding.horizontal,
    fontFamily: familyName(t, "body"),
    fontSize: t.body.fontSize,
    lineHeight: t.body.lineHeight,
  }
}

/** Running heads and page numbers. Pages are absolute; odd pages are on the right. */
function Furniture({ ctx, section }: { ctx: Ctx; section: ExportSection }) {
  const { template: t, geometry: g, doc, plan } = ctx
  const opening = plan?.starts.get(section.id)
  const front = plan?.frontPages ?? 0
  const left = g.padding.horizontal
  const folio = (n: number) => (n === opening ? "" : String(n - front))
  const headStyle = {
    position: "absolute" as const,
    top: g.padding.top - t.header.size * 3,
    left,
    right: left,
    fontSize: t.header.size,
    letterSpacing: t.header.letterSpacing,
    fontStyle: t.header.italic ? ("italic" as const) : ("normal" as const),
    textAlign: "center" as const,
    fontFamily: familyName(t, "heading"),
  }
  const head = (n: number) => {
    if (!t.header.show || n === opening) return ""
    const which = n % 2 === 0 ? t.header.verso : t.header.recto
    const text = which === "author" ? doc.authorName ?? doc.title : which === "title" ? doc.title : which === "chapter" ? section.title : ""
    return t.header.upper ? text.toUpperCase() : text
  }
  const footTop = g.pageHeight - g.padding.bottom + t.folio.size * 1.6
  const folioBase = { position: "absolute" as const, left, right: left, fontSize: t.folio.size }
  const pos = t.folio.position
  const top = pos === "top-outside" ? g.padding.top - t.folio.size * 3 : footTop
  return (
    <>
      <Text fixed style={headStyle} render={({ pageNumber }) => head(pageNumber)} />
      {pos === "bottom-center" ? (
        <Text fixed style={{ ...folioBase, top, textAlign: "center" }} render={({ pageNumber }) => folio(pageNumber)} />
      ) : (
        <>
          <Text fixed style={{ ...folioBase, top, textAlign: "right" }} render={({ pageNumber }) => (pageNumber % 2 === 1 ? folio(pageNumber) : "")} />
          <Text fixed style={{ ...folioBase, top, textAlign: "left" }} render={({ pageNumber }) => (pageNumber % 2 === 0 ? folio(pageNumber) : "")} />
        </>
      )}
    </>
  )
}

/** Records the absolute page this point lands on. */
function Marker({ ctx, id }: { ctx: Ctx; id: string }) {
  return <Text style={{ fontSize: 1, lineHeight: 1 }} render={({ pageNumber }) => (ctx.measured.set(id, pageNumber), "")} />
}

function ChapterOpener({ ctx, section }: { ctx: Ctx; section: ExportSection }) {
  const t = ctx.template
  const c = t.chapter
  const headingFamily = familyName(t, c.title.font === "heading" ? "heading" : "body")
  const label = section.numberLabel
  return (
    <View style={{ marginTop: c.sinkIn * POINTS_PER_INCH, marginBottom: t.body.fontSize * 2.2 }} wrap={false}>
      {c.number.show && label ? (
        <Text
          style={{
            fontFamily: headingFamily,
            fontSize: c.number.size,
            letterSpacing: c.number.letterSpacing,
            textAlign: c.title.align,
            marginBottom: c.number.size * 0.5,
            lineHeight: 1.1,
          }}
        >
          {c.number.case === "upper" ? label.toUpperCase() : label}
        </Text>
      ) : null}
      <Text
        style={{
          fontFamily: headingFamily,
          fontSize: c.title.size,
          letterSpacing: c.title.letterSpacing,
          fontStyle: c.title.italic ? "italic" : "normal",
          textAlign: c.title.align,
          lineHeight: 1.2,
        }}
      >
        {c.title.upper ? section.title.toUpperCase() : section.title}
      </Text>
      {c.ornament?.image ? (
        <View style={{ alignItems: c.title.align === "center" ? "center" : "flex-start", marginTop: c.title.size * 0.6 }}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt */}
          <Image src={ctx.resolveFile(c.ornament.image)} style={{ width: (c.ornament.widthIn ?? 0.8) * POINTS_PER_INCH }} />
        </View>
      ) : c.ornament?.glyph ? (
        <Text style={{ fontFamily: headingFamily, fontSize: c.title.size * 0.8, textAlign: c.title.align, marginTop: c.title.size * 0.4 }}>
          {c.ornament.glyph}
        </Text>
      ) : null}
    </View>
  )
}

function BlankPage({ ctx }: { ctx: Ctx }) {
  return <Page size={[ctx.geometry.pageWidth, ctx.geometry.pageHeight]} style={pageStyle(ctx)} />
}

function FrontMatter({ ctx }: { ctx: Ctx }) {
  const { doc, template: t, geometry: g, plan } = ctx
  const size: [number, number] = [g.pageWidth, g.pageHeight]
  const style = pageStyle(ctx)
  const heading = familyName(t, "heading")
  const pages: ReactNode[] = []

  if (doc.includeTitlePage) {
    pages.push(
      <Page key="title" size={size} style={style}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontFamily: heading, fontSize: t.chapter.title.size * 1.5, textAlign: "center", marginBottom: 18, lineHeight: 1.15 }}>
            {doc.title}
          </Text>
          {doc.authorName ? <Text style={{ fontFamily: heading, fontSize: t.body.fontSize * 1.3, letterSpacing: 1.5 }}>{doc.authorName.toUpperCase()}</Text> : null}
        </View>
      </Page>
    )
    // The copyright page sits on the back of the title page.
    pages.push(
      <Page key="copyright" size={size} style={style}>
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          {(ctx.copyright?.text ?? "").split(/\n{2,}/).map((para, i) => (
            <Text key={i} style={{ fontSize: t.body.fontSize * 0.78, lineHeight: 1.35, marginBottom: 6 }}>
              {para.trim()}
            </Text>
          ))}
        </View>
      </Page>
    )
  }

  if (doc.dedication) {
    pages.push(
      <Page key="dedication" size={size} style={style}>
        <Text style={{ marginTop: g.pageHeight * 0.28, textAlign: "center", fontStyle: "italic" }}>{doc.dedication}</Text>
      </Page>,
      <BlankPage key="dedication-back" ctx={ctx} />
    )
  }

  if (doc.includeTOC && doc.manuscript.length > 0) {
    const front = plan?.frontPages ?? 0
    pages.push(
      <Page key="toc" size={size} style={style} wrap>
        <Text style={{ fontFamily: heading, fontSize: t.chapter.title.size, textAlign: "center", marginTop: t.chapter.sinkIn * POINTS_PER_INCH * 0.6, marginBottom: 28 }}>
          Contents
        </Text>
        {doc.manuscript.map((s) => {
          const start = plan?.starts.get(s.id)
          return (
            <View key={s.id} style={{ flexDirection: "row", marginBottom: 6 }} wrap={false}>
              <Text style={{ flex: 1 }}>
                {s.numberLabel && s.numberLabel !== s.title ? `${s.numberLabel}: ` : ""}
                {s.title}
              </Text>
              {/* Same width in every pass, so filling the numbers in never moves anything. */}
              <Text style={{ width: t.body.fontSize * 2.6, textAlign: "right" }}>{start ? String(start - front) : "000"}</Text>
            </View>
          )
        })}
      </Page>
    )
  }

  if (plan?.padFront) pages.push(<BlankPage key="front-pad" ctx={ctx} />)
  return <>{pages}</>
}

function Book({ ctx }: { ctx: Ctx }) {
  const { doc, template: t, geometry: g, plan, resolveFile } = ctx
  const size: [number, number] = [g.pageWidth, g.pageHeight]
  const style = pageStyle(ctx)
  return (
    <Document title={doc.title} author={doc.authorName} creator="" producer="">
      <FrontMatter ctx={ctx} />
      {doc.manuscript.map((section) => (
        <Fragment key={section.id}>
          {plan?.blankBefore.has(section.id) ? <BlankPage ctx={ctx} /> : null}
          <Page size={size} style={style} wrap>
            <Furniture ctx={ctx} section={section} />
            <Marker ctx={ctx} id={section.id} />
            <ChapterOpener ctx={ctx} section={section} />
            <Blocks blocks={section.blocks} template={t} resolveFile={resolveFile} opening />
          </Page>
        </Fragment>
      ))}
      {doc.appendices.map((appendix) => {
        const id = `appendix:${appendix.heading}`
        const asSection: ExportSection = { id, title: appendix.heading, blocks: [] }
        return (
          <Fragment key={id}>
            {plan?.blankBefore.has(id) ? <BlankPage ctx={ctx} /> : null}
            <Page size={size} style={style} wrap>
              <Furniture ctx={ctx} section={asSection} />
              <Marker ctx={ctx} id={id} />
              <ChapterOpener ctx={ctx} section={asSection} />
              {appendix.sections.map((s) => (
                <Fragment key={s.id}>
                  <Text style={{ fontWeight: 700, fontSize: t.body.fontSize * 1.15, marginTop: t.body.fontSize, marginBottom: 4 }} minPresenceAhead={40}>
                    {s.title}
                  </Text>
                  <Blocks blocks={s.blocks} template={t} resolveFile={resolveFile} opening={false} />
                </Fragment>
              ))}
            </Page>
          </Fragment>
        )
      })}
    </Document>
  )
}

// ---------------------------------------------------------------------------
// Layout passes
// ---------------------------------------------------------------------------

async function layout(ctx: Ctx): Promise<{ bytes: Uint8Array; pageCount: number }> {
  ctx.measured.clear()
  const blob = await pdf(<Book ctx={ctx} />).toBlob()
  const bytes = new Uint8Array(await blob.arrayBuffer())
  const pageCount = (await PDFDocument.load(bytes, { updateMetadata: false })).getPageCount()
  return { bytes, pageCount }
}

/** Where blank pages go and where every section starts, from a pass without them. */
function makePlan(doc: ExportDocument, template: PrintTemplate, measured: Map<string, number>, pageCount: number): Plan {
  const ids = [...doc.manuscript.map((s) => s.id), ...doc.appendices.map((a) => `appendix:${a.heading}`)]
  const firstStart = ids.length ? measured.get(ids[0]) ?? pageCount + 1 : pageCount + 1
  const rawFront = firstStart - 1
  const padFront = rawFront % 2 === 1
  const frontPages = rawFront + (padFront ? 1 : 0)
  const lengths = ids.map((id, i) => {
    const start = measured.get(id) ?? firstStart
    const next = i + 1 < ids.length ? measured.get(ids[i + 1]) ?? pageCount + 1 : pageCount + 1
    return Math.max(1, next - start)
  })
  const blankBefore = new Set<string>()
  const starts = new Map<string, number>()
  let pos = frontPages + 1
  ids.forEach((id, i) => {
    if (template.chapter.startOnRecto && pos % 2 === 0) {
      blankBefore.add(id)
      pos++
    }
    starts.set(id, pos)
    pos += lengths[i]
  })
  return { frontPages, blankBefore, starts, padFront, pageCount: pos - 1 }
}

/** Builds the print PDF and reports its page count, margins and any warnings. */
export async function renderPrintPdf(doc: ExportDocument, opts: PrintOptions): Promise<{ blob: Blob; report: PrintReport }> {
  registerFonts(opts.template, opts.resolveFile)
  const step = (s: string) => opts.onProgress?.(s)

  // Start from a page-count guess (about 330 words a page on 6×9); refine.
  const words = doc.manuscript.reduce((n, s) => n + s.blocks.reduce((m, b) => m + b.runs.reduce((k, r) => k + ("text" in r ? r.text.split(/\s+/).length : 0), 0), 0), 0)
  let pages = Math.max(MIN_PAGES, Math.round(words / 330) + 8)
  let geometry = pageGeometry({ trimSizeId: opts.trimSizeId, pageCount: pages, printer: opts.printer, bleed: opts.bleed })
  const ctx: Ctx = { doc, template: opts.template, geometry, plan: null, resolveFile: opts.resolveFile, measured: new Map(), copyright: opts.copyright }

  let plan: Plan | null = null
  for (let attempt = 1; attempt <= 3; attempt++) {
    step(`Laying out pages (pass ${attempt})…`)
    ctx.plan = null
    ctx.geometry = geometry
    const first = await layout(ctx)
    plan = makePlan(doc, opts.template, ctx.measured, first.pageCount)
    // A different gutter means a different text width: lay out again.
    if (minimumGutterIn(plan.pageCount) === minimumGutterIn(pages)) break
    pages = plan.pageCount
    geometry = pageGeometry({ trimSizeId: opts.trimSizeId, pageCount: pages, printer: opts.printer, bleed: opts.bleed })
  }

  step("Adding page numbers and contents…")
  ctx.plan = plan
  ctx.geometry = geometry
  const final = await layout(ctx)

  step("Setting margins for binding…")
  const pdfDoc = await PDFDocument.load(final.bytes, { updateMetadata: false })
  const b = geometry.bleed ? 0.125 * POINTS_PER_INCH : 0
  const trimW = geometry.trim.widthIn * POINTS_PER_INCH
  const trimH = geometry.trim.heightIn * POINTS_PER_INCH
  pdfDoc.getPages().forEach((page, i) => {
    const recto = (i + 1) % 2 === 1
    page.translateContent(recto ? geometry.shift.recto : geometry.shift.verso, 0)
    // The trim box is where the page is cut; on a left-hand page the bleed is on the left.
    page.setTrimBox(recto ? 0 : b, b, trimW, trimH)
    page.setBleedBox(0, 0, geometry.pageWidth, geometry.pageHeight)
  })
  pdfDoc.setTitle(doc.title)
  if (doc.authorName) pdfDoc.setAuthor(doc.authorName)
  const out = await pdfDoc.save()

  const warnings: string[] = []
  const pageCount = pdfDoc.getPageCount()
  if (pageCount < MIN_PAGES) warnings.push(`Print books need at least ${MIN_PAGES} pages; this one has ${pageCount}.`)
  if (pageCount > MAX_PAGES) warnings.push(`KDP prints at most ${MAX_PAGES} pages; this one has ${pageCount}. Try a larger trim size or a smaller font.`)
  if (plan && final.pageCount !== plan.pageCount) {
    warnings.push("Page numbers in the contents may be off by a page. Export again to fix it.")
  }

  return {
    blob: new Blob([out.slice().buffer as ArrayBuffer], { type: "application/pdf" }),
    report: { pageCount, geometry, warnings, frontPages: plan?.frontPages ?? 0, starts: new Map(ctx.measured) },
  }
}
