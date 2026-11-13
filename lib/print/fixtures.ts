import type { ExportDocument, ExportSection } from "@/lib/export/document-model"

const SENTENCES = [
  "The lamps along the harbour wall had gone out one by one, and Mara counted them as they died.",
  "“We should not be here,” Tomas said, though he made no move to leave.",
  "Somewhere below, the tide dragged at the pilings with a sound like breathing.",
  "She thought of the letter in her coat, its seal unbroken, its weight out of all proportion to its size.",
  "Łódź, Zoë and the café on the corner had all been closed for a week.",
]

/** A sample book: `chapters` chapters of `paragraphs` paragraphs each, with a scene break midway. */
export function sampleBook(chapters: number, paragraphs: number): ExportDocument {
  const manuscript: ExportSection[] = Array.from({ length: chapters }, (_, c) => ({
    id: `c${c + 1}`,
    title: ["The Harbour", "Letters", "Night Crossing", "The Glass Tower", "Ashes", "Return"][c % 6],
    numberLabel: `Chapter ${c + 1}`,
    blocks: Array.from({ length: paragraphs }, (_, p) =>
      p === Math.floor(paragraphs / 2)
        ? { kind: "sceneBreak" as const, runs: [] as [] }
        : {
            kind: "paragraph" as const,
            runs: [
              { text: Array.from({ length: 4 }, (_, k) => SENTENCES[(p + k + c) % SENTENCES.length]).join(" "), marks: [] },
              ...(p % 3 === 0 ? [{ text: " Italic, too.", marks: ["italic" as const] }] : []),
            ],
          }
    ),
  }))
  return {
    title: "The Glass Tower",
    authorName: "A. N. Author",
    dedication: "For everyone who stayed up late.",
    includeTitlePage: true,
    includeTOC: true,
    isPoetry: false,
    trimSize: "6x9",
    manuscript,
    appendices: [],
  }
}
