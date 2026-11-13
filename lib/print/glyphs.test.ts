import { describe, expect, it } from "vitest"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { CLASSIC, MINIMAL } from "./builtin-templates"
import { findMissingGlyphs } from "./glyphs"
import { sampleBook } from "./fixtures"

const load = async (ref: string) => {
  const b = await readFile(path.resolve("public", ref.replace(/^\//, "")))
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer
}

describe("missing glyphs", () => {
  it("finds characters the template's font can't draw", async () => {
    const doc = sampleBook(1, 3)
    doc.manuscript[0].blocks.push({ kind: "paragraph", runs: [{ text: "Привет, Наташа.", marks: [] }] })
    const missing = await findMissingGlyphs(doc, MINIMAL, load)
    expect(missing).toContain("П")
    expect(missing).not.toContain("a")
    // EB Garamond has Cyrillic.
    expect(await findMissingGlyphs(doc, CLASSIC, load)).toEqual([])
  })
})
