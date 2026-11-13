import { describe, expect, it } from "vitest"
import { BUILTIN_TEMPLATES, CLASSIC } from "./builtin-templates"
import { TemplateError, mapTemplateFiles, templateFiles, validateTemplate } from "./template"

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v))

describe("print templates", () => {
  it("built-in templates are valid and survive validation unchanged", () => {
    for (const t of BUILTIN_TEMPLATES) expect(validateTemplate(clone(t))).toEqual(t)
  })

  it("lists and rewrites every file a template uses", () => {
    expect(templateFiles(CLASSIC)).toHaveLength(4)
    const mapped = mapTemplateFiles({ ...CLASSIC, sceneBreak: { image: "ornaments/leaf.png" } }, (f) => `asset:${f}`)
    expect(mapped.fonts.body.regular).toBe("asset:/fonts/eb-garamond/EBGaramond-Regular.ttf")
    expect(mapped.sceneBreak.image).toBe("asset:ornaments/leaf.png")
    expect(templateFiles(mapped).every((f) => f.startsWith("asset:"))).toBe(true)
  })

  it("rejects files that aren't templates, are too new, or are out of range", () => {
    expect(() => validateTemplate({})).toThrow(TemplateError)
    expect(() => validateTemplate({ ...clone(CLASSIC), formatVersion: 99 })).toThrow(/newer version/)
    const tiny = clone(CLASSIC)
    tiny.body.fontSize = 3
    expect(() => validateTemplate(tiny)).toThrow(/body.fontSize/)
    const bad = clone(CLASSIC)
    ;(bad.chapter as { initial: string }).initial = "dropped"
    expect(() => validateTemplate(bad)).toThrow(/chapter.initial/)
  })

  it("refuses file paths that escape the pack", () => {
    for (const path of ["../secret.ttf", "https://evil.example/font.ttf", "//cdn/font.ttf"]) {
      const t = clone(CLASSIC)
      t.fonts.body.regular = path
      expect(() => validateTemplate(t)).toThrow(/file in the pack/)
    }
  })
})
