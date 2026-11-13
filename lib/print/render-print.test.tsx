import { describe, expect, it } from "vitest"
import path from "node:path"
import { PDFDict, PDFDocument, PDFName } from "pdf-lib"
import { CLASSIC, MINIMAL, MODERN } from "./builtin-templates"
import { renderPrintPdf } from "./render-print"
import { sampleBook } from "./fixtures"

const resolveFile = (ref: string) => path.resolve("public", ref.replace(/^\//, ""))

async function fontsIn(blob: Blob) {
  const pdf = await PDFDocument.load(new Uint8Array(await blob.arrayBuffer()))
  let embedded = 0
  let notEmbedded = 0
  for (const [, obj] of pdf.context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFDict) || obj.get(PDFName.of("Type")) !== PDFName.of("Font")) continue
    const subtype = obj.get(PDFName.of("Subtype"))
    if (subtype === PDFName.of("Type0")) continue // a wrapper; its descendant carries the file
    const descriptor = obj.lookup(PDFName.of("FontDescriptor"))
    const hasFile =
      descriptor instanceof PDFDict &&
      ["FontFile", "FontFile2", "FontFile3"].some((k) => descriptor.get(PDFName.of(k)) !== undefined)
    if (hasFile) embedded++
    else notEmbedded++
  }
  return { embedded, notEmbedded, pdf }
}

describe("print PDF", () => {
  it("lays out a 6×9 interior KDP will accept", async () => {
    const doc = sampleBook(6, 18)
    const { blob, report } = await renderPrintPdf(doc, {
      template: CLASSIC,
      trimSizeId: "6x9",
      printer: "kdp",
      bleed: false,
      copyright: { text: "Copyright © 2026 A. N. Author\n\nAll rights reserved." },
      resolveFile,
    })
    const { embedded, notEmbedded, pdf } = await fontsIn(blob)

    // Every font is embedded; none are the unembedded standard 14.
    expect(embedded).toBeGreaterThan(0)
    expect(notEmbedded).toBe(0)

    // Trim size and boxes.
    const first = pdf.getPage(0)
    expect(first.getWidth()).toBeCloseTo(432)
    expect(first.getHeight()).toBeCloseTo(648)
    expect(first.getTrimBox().width).toBeCloseTo(432)

    // Front matter is even, so chapter one is on a right-hand page; with
    // Classic, every chapter starts on the right.
    expect(report.frontPages % 2).toBe(0)
    const starts = doc.manuscript.map((s) => report.starts.get(s.id)!)
    expect(starts[0]).toBe(report.frontPages + 1)
    for (const s of starts) expect(s % 2).toBe(1)
    for (let i = 1; i < starts.length; i++) expect(starts[i]).toBeGreaterThan(starts[i - 1])

    expect(report.pageCount).toBe(pdf.getPageCount())
    expect(report.pageCount).toBeGreaterThanOrEqual(24)
    expect(report.warnings).toEqual([])
  }, 120_000)

  it("adds bleed and works with the other templates", async () => {
    const doc = sampleBook(3, 10)
    for (const template of [MODERN, MINIMAL]) {
      const { blob, report } = await renderPrintPdf(doc, { template, trimSizeId: "5x8", printer: "kdp", bleed: true, resolveFile })
      const { notEmbedded, pdf } = await fontsIn(blob)
      expect(notEmbedded).toBe(0)
      const page = pdf.getPage(1) // a left-hand page: bleed on the left
      expect(page.getWidth()).toBeCloseTo(5.125 * 72)
      expect(page.getHeight()).toBeCloseTo(8.25 * 72)
      expect(page.getTrimBox().x).toBeCloseTo(9)
      expect(report.geometry.margins.outside).toBeGreaterThanOrEqual(0.375)
    }
  }, 120_000)

  it("warns when the book is too short to print", async () => {
    const { report } = await renderPrintPdf(
      { ...sampleBook(1, 2), includeTitlePage: false, includeTOC: false, dedication: undefined },
      { template: MINIMAL, trimSizeId: "6x9", printer: "kdp", bleed: false, resolveFile }
    )
    expect(report.warnings.join(" ")).toMatch(/at least 24 pages/)
  }, 60_000)
})
