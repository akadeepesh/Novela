/**
 * Print templates: how a book's interior looks (fonts, chapter openers,
 * scene breaks, running heads, page numbers). A template is plain JSON so
 * the community can write free ones and paid packs can ship as files; the
 * format is documented in templates/spec.md.
 *
 * Font and image fields hold a file reference: a URL path for templates
 * bundled with the app ("/fonts/…"), or a path inside the pack zip
 * ("fonts/…") that is turned into an `asset:` reference on import.
 */

export const TEMPLATE_FORMAT = "novela-template"
/** The id used before the rename, still read. */
const LEGACY_TEMPLATE_FORMAT = "korakagaj-template"
export const TEMPLATE_FORMAT_VERSION = 1

export type FontFamilySpec = {
  /** A unique family name, e.g. "EB Garamond". */
  family: string
  regular: string
  italic?: string
  bold?: string
  boldItalic?: string
}

export type PrintTemplate = {
  format: typeof TEMPLATE_FORMAT
  formatVersion: number
  id: string
  name: string
  description?: string
  author?: string
  version?: string
  /** Licence notes for fonts and ornaments, shown with the template. */
  license?: string
  fonts: { body: FontFamilySpec; heading?: FontFamilySpec }
  body: {
    /** Points. */
    fontSize: number
    /** Multiple of the font size. */
    lineHeight: number
    align: "justify" | "left"
    /** First-line indent, in multiples of the font size. 0 for block paragraphs. */
    indent: number
    /** Space between paragraphs, in points (usually 0 when indenting). */
    paragraphSpacing: number
  }
  chapter: {
    /** Start every chapter on a right-hand page, adding a blank page when needed. */
    startOnRecto: boolean
    /** How far down the page the chapter heading starts, in inches. */
    sinkIn: number
    number: { show: boolean; case: "upper" | "title"; size: number; letterSpacing: number }
    title: { size: number; align: "center" | "left"; font: "heading" | "body"; italic: boolean; upper: boolean; letterSpacing: number }
    /** An ornament under the heading: a glyph in the heading font, or an image. */
    ornament?: { glyph?: string; image?: string; widthIn?: number }
    /** Set the first words of a chapter in capitals. */
    leadInWords: number
  }
  sceneBreak: { glyph?: string; image?: string; widthIn?: number }
  header: {
    show: boolean
    verso: "author" | "title" | "none"
    recto: "title" | "chapter" | "none"
    size: number
    upper: boolean
    italic: boolean
    letterSpacing: number
  }
  folio: { position: "bottom-center" | "bottom-outside" | "top-outside"; size: number }
}

/** Every file a template points at (fonts and images), for import and loading. */
export function templateFiles(t: PrintTemplate): string[] {
  const fonts = [t.fonts.body, t.fonts.heading].filter((f): f is FontFamilySpec => Boolean(f))
  return [
    ...fonts.flatMap((f) => [f.regular, f.italic, f.bold, f.boldItalic]),
    t.chapter.ornament?.image,
    t.sceneBreak.image,
  ].filter((f): f is string => Boolean(f))
}

/** A copy of the template with every file reference passed through `map`. */
export function mapTemplateFiles(t: PrintTemplate, map: (ref: string) => string): PrintTemplate {
  const font = (f: FontFamilySpec): FontFamilySpec => ({
    family: f.family,
    regular: map(f.regular),
    ...(f.italic && { italic: map(f.italic) }),
    ...(f.bold && { bold: map(f.bold) }),
    ...(f.boldItalic && { boldItalic: map(f.boldItalic) }),
  })
  return {
    ...t,
    fonts: { body: font(t.fonts.body), ...(t.fonts.heading && { heading: font(t.fonts.heading) }) },
    chapter: {
      ...t.chapter,
      ...(t.chapter.ornament && {
        ornament: { ...t.chapter.ornament, ...(t.chapter.ornament.image && { image: map(t.chapter.ornament.image) }) },
      }),
    },
    sceneBreak: { ...t.sceneBreak, ...(t.sceneBreak.image && { image: map(t.sceneBreak.image) }) },
  }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export class TemplateError extends Error {}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

function num(v: unknown, name: string, min: number, max: number): number {
  if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max) {
    throw new TemplateError(`“${name}” should be a number from ${min} to ${max}.`)
  }
  return v
}

function str(v: unknown, name: string, max = 200): string {
  if (typeof v !== "string" || !v.trim() || v.length > max) throw new TemplateError(`“${name}” is missing or too long.`)
  return v
}

function optStr(v: unknown, name: string, max = 200): string | undefined {
  return v === undefined ? undefined : str(v, name, max)
}

function oneOf<T extends string>(v: unknown, name: string, options: readonly T[]): T {
  if (typeof v !== "string" || !options.includes(v as T)) throw new TemplateError(`“${name}” should be one of: ${options.join(", ")}.`)
  return v as T
}

function bool(v: unknown, name: string): boolean {
  if (typeof v !== "boolean") throw new TemplateError(`“${name}” should be true or false.`)
  return v
}

/** A file path inside a pack: relative, no "..", no scheme. Bundled templates may use "/fonts/…". */
function filePath(v: unknown, name: string): string {
  const s = str(v, name, 300)
  if (s.includes("..") || /^[a-z]+:/i.test(s) || s.startsWith("//")) throw new TemplateError(`“${name}” must be a file in the pack.`)
  return s
}

function font(v: unknown, name: string): FontFamilySpec {
  if (!isObj(v)) throw new TemplateError(`“${name}” is missing.`)
  return {
    family: str(v.family, `${name}.family`, 80),
    regular: filePath(v.regular, `${name}.regular`),
    ...(v.italic !== undefined && { italic: filePath(v.italic, `${name}.italic`) }),
    ...(v.bold !== undefined && { bold: filePath(v.bold, `${name}.bold`) }),
    ...(v.boldItalic !== undefined && { boldItalic: filePath(v.boldItalic, `${name}.boldItalic`) }),
  }
}

function decoration(v: unknown, name: string): { glyph?: string; image?: string; widthIn?: number } {
  if (!isObj(v)) throw new TemplateError(`“${name}” should be an object.`)
  return {
    ...(v.glyph !== undefined && { glyph: str(v.glyph, `${name}.glyph`, 20) }),
    ...(v.image !== undefined && { image: filePath(v.image, `${name}.image`) }),
    ...(v.widthIn !== undefined && { widthIn: num(v.widthIn, `${name}.widthIn`, 0.1, 4) }),
  }
}

/** Checks untrusted template JSON and returns a clean copy. Throws TemplateError with a readable message. */
export function validateTemplate(raw: unknown): PrintTemplate {
  if (!isObj(raw) || (raw.format !== TEMPLATE_FORMAT && raw.format !== LEGACY_TEMPLATE_FORMAT)) throw new TemplateError("This isn't a print template.")
  const formatVersion = num(raw.formatVersion, "formatVersion", 1, 1000)
  if (formatVersion > TEMPLATE_FORMAT_VERSION) {
    throw new TemplateError("This template needs a newer version of the app. Reload to update, then try again.")
  }
  const id = str(raw.id, "id", 80)
  if (!/^[a-z0-9][a-z0-9._/-]*$/.test(id)) throw new TemplateError("“id” may only use lowercase letters, numbers, dots, dashes and slashes.")
  if (!isObj(raw.fonts) || !isObj(raw.body) || !isObj(raw.chapter) || !isObj(raw.sceneBreak) || !isObj(raw.header) || !isObj(raw.folio)) {
    throw new TemplateError("The template is missing a section (fonts, body, chapter, sceneBreak, header or folio).")
  }
  const { body, chapter: ch, header, folio } = raw
  if (!isObj(ch.number) || !isObj(ch.title)) throw new TemplateError("“chapter” needs “number” and “title”.")
  return {
    format: TEMPLATE_FORMAT,
    formatVersion,
    id,
    name: str(raw.name, "name", 80),
    ...(raw.description !== undefined && { description: optStr(raw.description, "description", 500) }),
    ...(raw.author !== undefined && { author: optStr(raw.author, "author", 120) }),
    ...(raw.version !== undefined && { version: optStr(raw.version, "version", 40) }),
    ...(raw.license !== undefined && { license: optStr(raw.license, "license", 4000) }),
    fonts: {
      body: font(raw.fonts.body, "fonts.body"),
      ...(raw.fonts.heading !== undefined && { heading: font(raw.fonts.heading, "fonts.heading") }),
    },
    body: {
      fontSize: num(body.fontSize, "body.fontSize", 7, 16),
      lineHeight: num(body.lineHeight, "body.lineHeight", 1, 2.2),
      align: oneOf(body.align, "body.align", ["justify", "left"] as const),
      indent: num(body.indent, "body.indent", 0, 4),
      paragraphSpacing: num(body.paragraphSpacing, "body.paragraphSpacing", 0, 24),
    },
    chapter: {
      startOnRecto: bool(ch.startOnRecto, "chapter.startOnRecto"),
      sinkIn: num(ch.sinkIn, "chapter.sinkIn", 0, 4),
      number: {
        show: bool(ch.number.show, "chapter.number.show"),
        case: oneOf(ch.number.case, "chapter.number.case", ["upper", "title"] as const),
        size: num(ch.number.size, "chapter.number.size", 6, 72),
        letterSpacing: num(ch.number.letterSpacing, "chapter.number.letterSpacing", 0, 10),
      },
      title: {
        size: num(ch.title.size, "chapter.title.size", 8, 72),
        align: oneOf(ch.title.align, "chapter.title.align", ["center", "left"] as const),
        font: oneOf(ch.title.font, "chapter.title.font", ["heading", "body"] as const),
        italic: bool(ch.title.italic, "chapter.title.italic"),
        upper: bool(ch.title.upper, "chapter.title.upper"),
        letterSpacing: num(ch.title.letterSpacing, "chapter.title.letterSpacing", 0, 10),
      },
      ...(ch.ornament !== undefined && { ornament: decoration(ch.ornament, "chapter.ornament") }),
      leadInWords: num(ch.leadInWords, "chapter.leadInWords", 0, 8),
    },
    sceneBreak: decoration(raw.sceneBreak, "sceneBreak"),
    header: {
      show: bool(header.show, "header.show"),
      verso: oneOf(header.verso, "header.verso", ["author", "title", "none"] as const),
      recto: oneOf(header.recto, "header.recto", ["title", "chapter", "none"] as const),
      size: num(header.size, "header.size", 5, 14),
      upper: bool(header.upper, "header.upper"),
      italic: bool(header.italic, "header.italic"),
      letterSpacing: num(header.letterSpacing, "header.letterSpacing", 0, 10),
    },
    folio: {
      position: oneOf(folio.position, "folio.position", ["bottom-center", "bottom-outside", "top-outside"] as const),
      size: num(folio.size, "folio.size", 5, 14),
    },
  }
}
