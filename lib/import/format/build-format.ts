import type { ExtractedText } from "@/lib/import/extract/types";
import type { StructureResult } from "@/lib/import/structure/types";
import { titleFromFirstLine } from "@/lib/import/structure/segment";
import { median } from "@/lib/import/structure/text-shapes";
import type { ProjectType } from "@/lib/project-config";
import { bodyStyleToStrip, prepareLines } from "./lines";
import { buildProse } from "./prose";
import { buildVerse } from "./verse";
import { countWords, emptyDoc } from "./tiptap";
import type { FormattedBook, FormattedPiece, TiptapDoc } from "./types";

/**
 * Step 5: turns each detected piece into a real Tiptap document — the shape
 * `lib/models/chapter.ts` stores — rebuilding what the PDF flattened:
 * line wraps, stanzas / paragraphs, bold and italic, headings, centering.
 *
 * Pure and synchronous (no I/O), like Step 4, so the progress pipeline can
 * call it per piece and the review screen can rebuild a piece after the
 * person merges or splits it.
 */
export function formatBook(extracted: ExtractedText, structure: StructureResult): FormattedBook {
  const projectType: ProjectType = structure.projectType;
  const strip = bodyStyleToStrip(extracted);
  const bodySize = extracted.profile.bodySize ?? 12;
  const bookNotes: string[] = [];
  if (strip.bold) bookNotes.push("The whole book is set in a bold face, so bold wasn’t carried over as emphasis.");
  if (strip.italic) bookNotes.push("The whole book is set in an italic face, so italic wasn’t carried over as emphasis.");

  const pieces: FormattedPiece[] = structure.pieces.map((piece) => {
    const pls = prepareLines(extracted, piece.lines);

    // Poetry is verse. Prose types flow. "Custom" could be either: judge by how the lines are set.
    const medianFill = pls.length ? median(pls.map((p) => p.fill)) : 1;
    const layout: "verse" | "prose" =
      projectType === "poetry" ? "verse" : projectType === "custom" && pls.length >= 4 && medianFill < 0.75 ? "verse" : "prose";

    let doc: TiptapDoc;
    let firstLine = "";
    let align: FormattedPiece["align"] = "left";
    let centeredShare = 0;
    let stats: FormattedPiece["stats"];

    if (layout === "verse") {
      const v = buildVerse(pls, strip);
      doc = v.nodes.length ? { type: "doc", content: v.nodes } : emptyDoc();
      firstLine = v.firstLine;
      align = v.align;
      centeredShare = v.centeredShare;
      stats = { lines: pls.length, blocks: v.nodes.length, headings: 0, ...v.stats };
    } else {
      const p = buildProse(pls, strip, { bodySize, script: projectType === "script-writing" });
      doc = p.nodes.length ? { type: "doc", content: p.nodes } : emptyDoc();
      firstLine = p.firstLine;
      const centeredBlocks = p.nodes.filter((n) => (n.attrs as { textAlign?: string } | undefined)?.textAlign === "center").length;
      centeredShare = p.nodes.length ? centeredBlocks / p.nodes.length : 0;
      stats = { lines: pls.length, blocks: p.nodes.length, ...p.stats };
    }

    // An untitled piece is named after its first line — the wrapped line rejoined, so a title never ends mid-sentence.
    const title =
      piece.titleSource === "first-line" && firstLine ? titleFromFirstLine(firstLine) : piece.title;

    const notes: string[] = [];
    if (pls.length === 0) notes.push("No text was found in this piece.");
    if (stats.rejoinedWraps > 0)
      notes.push(`${stats.rejoinedWraps} line${stats.rejoinedWraps === 1 ? "" : "s"} the page had cut short ${stats.rejoinedWraps === 1 ? "was" : "were"} put back together.`);
    if (stats.dehyphenated > 0) notes.push(`${stats.dehyphenated} hyphenated word${stats.dehyphenated === 1 ? "" : "s"} repaired.`);
    if (piece.endPage > piece.startPage) notes.push(`Runs across pages ${piece.startPage}–${piece.endPage}; the page break was kept as a break.`);

    return {
      index: piece.index,
      kind: piece.kind,
      title,
      titleSource: piece.titleSource,
      confidence: piece.confidence,
      reasons: piece.reasons,
      startPage: piece.startPage,
      endPage: piece.endPage,
      layout,
      align,
      centeredShare,
      doc,
      wordCount: pls.length ? countWords(doc) : 0,
      stats,
      notes,
    };
  });

  const totals = {
    pieces: pieces.length,
    words: pieces.reduce((n, p) => n + p.wordCount, 0),
    rejoinedWraps: pieces.reduce((n, p) => n + p.stats.rejoinedWraps, 0),
    dehyphenated: pieces.reduce((n, p) => n + p.stats.dehyphenated, 0),
    centeredPieces: pieces.filter((p) => p.align === "center").length,
  };
  const verse = pieces.filter((p) => p.layout === "verse");
  if (verse.length && totals.centeredPieces > 0 && totals.centeredPieces < verse.length) {
    bookNotes.push(`${totals.centeredPieces} of ${verse.length} poems are centered; the rest are set to the left.`);
  }

  return { version: 1, projectType, pieces, notes: bookNotes, totals };
}
