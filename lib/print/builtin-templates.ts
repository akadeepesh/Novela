import { TEMPLATE_FORMAT, TEMPLATE_FORMAT_VERSION, type FontFamilySpec, type PrintTemplate } from "./template"

/** The free templates that ship with the app. Their fonts live in public/fonts (OFL). */

const EB_GARAMOND: FontFamilySpec = {
  family: "EB Garamond",
  regular: "/fonts/eb-garamond/EBGaramond-Regular.ttf",
  italic: "/fonts/eb-garamond/EBGaramond-Italic.ttf",
  bold: "/fonts/eb-garamond/EBGaramond-Bold.ttf",
  boldItalic: "/fonts/eb-garamond/EBGaramond-BoldItalic.ttf",
}

const SOURCE_SERIF: FontFamilySpec = {
  family: "Source Serif 4",
  regular: "/fonts/source-serif-4/SourceSerif4-Regular.ttf",
  italic: "/fonts/source-serif-4/SourceSerif4-It.ttf",
  bold: "/fonts/source-serif-4/SourceSerif4-Bold.ttf",
  boldItalic: "/fonts/source-serif-4/SourceSerif4-BoldIt.ttf",
}

const CRIMSON: FontFamilySpec = {
  family: "Crimson Pro",
  regular: "/fonts/crimson-pro/CrimsonPro-Regular.ttf",
  italic: "/fonts/crimson-pro/CrimsonPro-Italic.ttf",
  bold: "/fonts/crimson-pro/CrimsonPro-Bold.ttf",
  boldItalic: "/fonts/crimson-pro/CrimsonPro-BoldItalic.ttf",
}

const base = { format: TEMPLATE_FORMAT, formatVersion: TEMPLATE_FORMAT_VERSION } as const

export const CLASSIC: PrintTemplate = {
  ...base,
  id: "classic",
  name: "Classic",
  description: "Garamond, justified, centred chapter openers with a fleuron. The traditional novel.",
  license: "EB Garamond: SIL Open Font License 1.1.",
  fonts: { body: EB_GARAMOND },
  body: { fontSize: 11.5, lineHeight: 1.38, align: "justify", indent: 1.4, paragraphSpacing: 0 },
  chapter: {
    startOnRecto: true,
    sinkIn: 1.6,
    number: { show: true, case: "upper", size: 10, letterSpacing: 2.5 },
    title: { size: 20, align: "center", font: "body", italic: true, upper: false, letterSpacing: 0 },
    ornament: { glyph: "❦" },
    initial: "raised",
    leadInWords: 3,
  },
  sceneBreak: { glyph: "❦" },
  header: { show: true, verso: "author", recto: "title", size: 8.5, upper: true, italic: false, letterSpacing: 1.5 },
  folio: { position: "bottom-center", size: 9.5 },
}

export const MODERN: PrintTemplate = {
  ...base,
  id: "modern",
  name: "Modern",
  description: "Source Serif with large left-aligned chapter numbers and clean running heads.",
  license: "Source Serif 4: SIL Open Font License 1.1 (Reserved Font Name “Source”).",
  fonts: { body: SOURCE_SERIF },
  body: { fontSize: 10.5, lineHeight: 1.45, align: "justify", indent: 1.2, paragraphSpacing: 0 },
  chapter: {
    startOnRecto: false,
    sinkIn: 1.2,
    number: { show: true, case: "upper", size: 30, letterSpacing: 0 },
    title: { size: 15, align: "left", font: "body", italic: false, upper: false, letterSpacing: 0 },
    initial: "none",
    leadInWords: 0,
  },
  sceneBreak: { glyph: "*  *  *" },
  header: { show: true, verso: "title", recto: "chapter", size: 8, upper: false, italic: true, letterSpacing: 0 },
  folio: { position: "bottom-outside", size: 9 },
}

export const MINIMAL: PrintTemplate = {
  ...base,
  id: "minimal",
  name: "Minimal",
  description: "Crimson Pro, ragged right, no running heads. Quiet and spacious.",
  license: "Crimson Pro: SIL Open Font License 1.1.",
  fonts: { body: CRIMSON },
  body: { fontSize: 12, lineHeight: 1.45, align: "left", indent: 1.2, paragraphSpacing: 0 },
  chapter: {
    startOnRecto: false,
    sinkIn: 1,
    number: { show: true, case: "title", size: 11, letterSpacing: 0.5 },
    title: { size: 17, align: "center", font: "body", italic: false, upper: false, letterSpacing: 0 },
    initial: "none",
    leadInWords: 0,
  },
  sceneBreak: { glyph: "*" },
  header: { show: false, verso: "none", recto: "none", size: 8, upper: false, italic: false, letterSpacing: 0 },
  folio: { position: "bottom-center", size: 10 },
}

export const BUILTIN_TEMPLATES: PrintTemplate[] = [CLASSIC, MODERN, MINIMAL]

export const DEFAULT_TEMPLATE_ID = CLASSIC.id
