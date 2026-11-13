import { describe, expect, it } from "vitest"
import { writeFileSync } from "node:fs"
import path from "node:path"
import { PDFDocument } from "pdf-lib"
import { CLASSIC } from "./builtin-templates"
import { renderCoverPdf, textColourFor } from "./render-cover"

const resolveFile = (r: string) => path.resolve("public", r.replace(/^\//, ""))

describe("cover PDF", () => {
  it("is the full wraparound size with bleed and spine", async () => {
    const blob = await renderCoverPdf({
      title: "The Glass Tower",
      author: "A. N. Author",
      blurb: "A lamplighter, a letter, and a tower made of glass. ".repeat(6),
      template: CLASSIC,
      trimSizeId: "6x9",
      pageCount: 300,
      paper: "cream",
      background: "#1f2a36",
      resolveFile,
    })
    const bytes = new Uint8Array(await blob.arrayBuffer())
    if (process.env.PRINT_SAMPLES) writeFileSync(path.join(process.env.PRINT_SAMPLES, "cover.pdf"), bytes)
    const page = (await PDFDocument.load(bytes)).getPage(0)
    expect(page.getWidth()).toBeCloseTo((0.125 + 6 + 0.75 + 6 + 0.125) * 72)
    expect(page.getHeight()).toBeCloseTo(9.25 * 72)
  }, 60_000)

  it("picks readable text colours", () => {
    expect(textColourFor("#1f2a36")).toBe("#ffffff")
    expect(textColourFor("#f4efe6")).toBe("#1b1b1b")
  })
})
