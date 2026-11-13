import { describe, expect, it } from "vitest"
import { coverSize, minimumGutterIn, pageGeometry, spineWidthIn } from "./specs"

const P = 72

describe("print specs", () => {
  it("follows KDP's gutter table", () => {
    expect([24, 150, 151, 300, 301, 500, 501, 700, 701, 828].map(minimumGutterIn)).toEqual([
      0.375, 0.375, 0.5, 0.5, 0.625, 0.625, 0.75, 0.75, 0.875, 0.875,
    ])
  })

  it("mirrors margins: gutter on the spine side of every page", () => {
    const g = pageGeometry({ trimSizeId: "6x9", pageCount: 320, printer: "kdp", bleed: false })
    expect(g.pageWidth).toBe(6 * P)
    expect(g.pageHeight).toBe(9 * P)
    // Text starts `inside` from the left on a right-hand page, `outside` on a left-hand page.
    expect(g.padding.horizontal + g.shift.recto).toBeCloseTo(g.margins.inside * P)
    expect(g.padding.horizontal + g.shift.verso).toBeCloseTo(g.margins.outside * P)
    expect(g.margins.inside).toBeGreaterThanOrEqual(0.625)
    expect(g.textWidth).toBeCloseTo((6 - g.margins.inside - g.margins.outside) * P)
  })

  it("adds bleed on the outside, top and bottom, with bigger minimums", () => {
    const g = pageGeometry({ trimSizeId: "5x8", pageCount: 100, printer: "kdp", bleed: true })
    expect(g.pageWidth).toBeCloseTo(5.125 * P)
    expect(g.pageHeight).toBeCloseTo(8.25 * P)
    expect(g.margins.outside).toBeGreaterThanOrEqual(0.375)
    // Left-hand page: bleed sits on the left edge, then the outside margin.
    expect(g.padding.horizontal + g.shift.verso).toBeCloseTo((0.125 + g.margins.outside) * P)
    expect(g.padding.top).toBeCloseTo((0.125 + g.margins.top) * P)
  })

  it("uses IngramSpark's half-inch minimum", () => {
    const g = pageGeometry({ trimSizeId: "5x8", pageCount: 100, printer: "ingramspark", bleed: false })
    expect(Math.min(g.margins.outside, g.margins.top, g.margins.bottom)).toBeGreaterThanOrEqual(0.5)
    expect(g.margins.inside).toBeGreaterThanOrEqual(0.5)
  })

  it("sizes spines and full covers", () => {
    expect(spineWidthIn(300, "white")).toBeCloseTo(0.6756)
    expect(spineWidthIn(300, "cream")).toBeCloseTo(0.75)
    const c = coverSize({ trimSizeId: "6x9", pageCount: 300, paper: "cream" })
    expect(c.widthIn).toBeCloseTo(0.125 + 6 + 0.75 + 6 + 0.125)
    expect(c.heightIn).toBeCloseTo(9.25)
    expect(c.spineText).toBe(true)
    expect(coverSize({ trimSizeId: "6x9", pageCount: 60, paper: "cream" }).spineText).toBe(false)
  })
})
