# Print template format

A print template describes how a book's printed interior looks: fonts, body text, chapter openings, scene breaks, running heads and page numbers. Templates are plain JSON, and a **template pack** is a zip with one or more templates and the fonts and images they use.

Writers import packs in **Settings → Print templates**, and choose a template on a book's **Export** page. Everything stays on the writer's device.

The app validates every file strictly (see `lib/print/template.ts` and `lib/print/packs.ts`). Unknown fields are ignored. Missing or out-of-range fields stop the import with a message that names the field.

## Pack layout

```
my-pack.zip
├── pack.json
├── templates/
│   └── ornate.json
├── fonts/
│   ├── MySerif-Regular.ttf
│   ├── MySerif-Italic.ttf
│   └── …
├── ornaments/
│   └── leaf.png
└── LICENSES.txt          (recommended: the licence of every font and image)
```

### `pack.json`

```json
{
  "format": "korakagaj-template-pack",
  "formatVersion": 1,
  "name": "Fantasy Pack",
  "version": "1.0",
  "templates": ["templates/ornate.json"]
}
```

| Field | Rules |
|---|---|
| `format` | Exactly `"korakagaj-template-pack"`. |
| `formatVersion` | `1`. Files that need a newer app are refused with a request to update. |
| `name`, `version` | Shown in Settings. |
| `templates` | 1 to 30 paths to template JSON files inside the zip. |

### Files

- **Fonts:** TTF, OTF or WOFF, each up to 15 MB.
- **Images:** PNG or JPEG, each up to 5 MB.
- **Whole pack:** up to 80 MB.
- **Paths:** relative to the zip root, and must not contain `..`, a scheme (`https:`) or a leading `/`. Every referenced file must be in the zip.

**Licences:** use only fonts and images whose licence allows embedding in PDFs and redistribution, such as the SIL Open Font License or a commercial licence that covers it. Printers require every font to be embedded.

## Template JSON

```json
{
  "format": "korakagaj-template",
  "formatVersion": 1,
  "id": "fantasy/ornate",
  "name": "Ornate",
  "description": "Old-style serif with leafy ornaments.",
  "author": "Your name",
  "version": "1.0",
  "license": "MySerif: SIL Open Font License 1.1. Leaf ornament: CC0.",
  "fonts": {
    "body": {
      "family": "My Serif",
      "regular": "fonts/MySerif-Regular.ttf",
      "italic": "fonts/MySerif-Italic.ttf",
      "bold": "fonts/MySerif-Bold.ttf",
      "boldItalic": "fonts/MySerif-BoldItalic.ttf"
    },
    "heading": { "family": "My Display", "regular": "fonts/MyDisplay.ttf" }
  },
  "body": { "fontSize": 11.5, "lineHeight": 1.38, "align": "justify", "indent": 1.4, "paragraphSpacing": 0 },
  "chapter": {
    "startOnRecto": true,
    "sinkIn": 1.6,
    "number": { "show": true, "case": "upper", "size": 10, "letterSpacing": 2.5 },
    "title": { "size": 20, "align": "center", "font": "heading", "italic": false, "upper": false, "letterSpacing": 0 },
    "ornament": { "image": "ornaments/leaf.png", "widthIn": 0.8 },
    "leadInWords": 3
  },
  "sceneBreak": { "image": "ornaments/leaf.png", "widthIn": 0.5 },
  "header": { "show": true, "verso": "author", "recto": "title", "size": 8.5, "upper": true, "italic": false, "letterSpacing": 1.5 },
  "folio": { "position": "bottom-center", "size": 9.5 }
}
```

### Fields

| Field | Values | Meaning |
|---|---|---|
| `id` | lowercase letters, numbers, `.`, `-`, `_`, `/` | Unique id. Importing a template with the same id replaces it. The built-in ids `classic`, `modern` and `minimal` are reserved. Use a prefix such as `fantasy/`. |
| `fonts.body` | font family | Body text, front matter and running heads. `regular` is required; a missing style falls back to `regular`. |
| `fonts.heading` | font family, optional | Used by `chapter.title.font: "heading"` and running heads. Defaults to the body font. |
| `body.fontSize` | 7–16 (points) | |
| `body.lineHeight` | 1–2.2 | Multiple of the font size. |
| `body.align` | `justify`, `left` | |
| `body.indent` | 0–4 | First-line indent in multiples of the font size. The first paragraph of a chapter, and paragraphs after a heading, scene break, list or quote, are never indented. |
| `body.paragraphSpacing` | 0–24 (points) | Space after each paragraph. Usually 0 when indenting. |
| `chapter.startOnRecto` | true / false | Start every chapter on a right-hand page, adding a blank page when needed. |
| `chapter.sinkIn` | 0–4 (inches) | How far down the page the chapter heading starts. |
| `chapter.number` | `show`, `case` (`upper`, `title`), `size` 6–72, `letterSpacing` 0–10 | The "Chapter One" line. Its wording comes from the book's numbering setting. |
| `chapter.title` | `size` 8–72, `align` (`center`, `left`), `font` (`heading`, `body`), `italic`, `upper`, `letterSpacing` 0–10 | |
| `chapter.ornament` | optional: `glyph` (≤ 20 characters, in the heading font) or `image` with `widthIn` 0.1–4 | Shown under the chapter title. |
| `chapter.leadInWords` | 0–8 | Set the chapter's first words in capitals. |
| `sceneBreak` | `glyph` or `image` with `widthIn` | Defaults to `*  *  *`. Check that the glyph exists in your font: the exporter warns about characters a font can't draw. |
| `header` | `show`, `verso` (`author`, `title`, `none`), `recto` (`title`, `chapter`, `none`), `size` 5–14, `upper`, `italic`, `letterSpacing` | Running heads. Never shown on chapter openings, blank pages or front matter. |
| `folio` | `position` (`bottom-center`, `bottom-outside`, `top-outside`), `size` 5–14 | Page numbers. Numbering starts at 1 on the first chapter. |

### What the app handles for every template

- Trim size, margins, the gutter (which grows with page count, per KDP's table), mirrored margins and bleed.
- Front matter: title page, copyright page, dedication, and contents with page numbers.
- Embedding fonts and setting the PDF trim and bleed boxes.

### Not supported (yet)

- **Large drop caps.** The PDF layout engine overlaps lines when one character is much bigger than the rest.
- **Per-trim-size margin overrides.**
- **Cover templates.** The cover PDF uses the template's fonts but has a fixed layout.
