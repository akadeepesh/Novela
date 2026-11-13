import * as fontkit from "fontkit"
import type { ExportDocument, ExportRun } from "@/lib/export/document-model"
import type { PrintTemplate } from "./template"

/**
 * Characters in the book that the template's fonts can't draw. Without a
 * glyph a character prints as nothing at all, so the writer is warned
 * before uploading. Only the fonts actually used are checked: italic text
 * against the italic font, and so on.
 */
export async function findMissingGlyphs(
  doc: ExportDocument,
  template: PrintTemplate,
  loadFont: (ref: string) => Promise<ArrayBuffer>,
  extraText: string[] = []
): Promise<string[]> {
  const byStyle = { regular: new Set<string>(), italic: new Set<string>(), bold: new Set<string>(), boldItalic: new Set<string>() }
  const add = (set: Set<string>, text: string) => {
    for (const ch of text) if (!/\s/u.test(ch)) set.add(ch)
  }
  const addRuns = (runs: ExportRun[]) => {
    for (const r of runs) {
      if (!("text" in r)) continue
      const b = r.marks.includes("bold")
      const i = r.marks.includes("italic")
      add(b && i ? byStyle.boldItalic : b ? byStyle.bold : i ? byStyle.italic : byStyle.regular, r.text)
    }
  }
  for (const t of [doc.title, doc.authorName ?? "", doc.dedication ?? "", ...extraText]) add(byStyle.regular, t)
  if (doc.dedication) add(byStyle.italic, doc.dedication)
  const sections = [...doc.manuscript, ...doc.appendices.flatMap((a) => a.sections)]
  for (const s of sections) {
    add(byStyle.regular, `${s.title} ${s.numberLabel ?? ""}`.toUpperCase() + s.title)
    if (template.chapter.title.italic) add(byStyle.italic, s.title)
    for (const block of s.blocks) addRuns(block.runs)
  }
  if (template.sceneBreak.glyph) add(byStyle.regular, template.sceneBreak.glyph)
  if (template.chapter.ornament?.glyph) add(byStyle.regular, template.chapter.ornament.glyph)

  const spec = template.fonts.body
  const files = {
    regular: spec.regular,
    italic: spec.italic ?? spec.regular,
    bold: spec.bold ?? spec.regular,
    boldItalic: spec.boldItalic ?? spec.bold ?? spec.regular,
  }
  const missing = new Set<string>()
  for (const style of Object.keys(byStyle) as (keyof typeof byStyle)[]) {
    if (byStyle[style].size === 0) continue
    const data = new Uint8Array(await loadFont(files[style]))
    const font = fontkit.create(data as unknown as Buffer)
    if (!("hasGlyphForCodePoint" in font)) continue
    for (const ch of byStyle[style]) {
      if (!font.hasGlyphForCodePoint(ch.codePointAt(0)!)) missing.add(ch)
    }
  }
  return [...missing].sort()
}
