/**
 * Output shapes for Step 5 (formatting reconstruction). Plain JSON-able data,
 * no server-only imports — the review screen and the commit step both read it.
 */
import type { Confidence, DetectedPiece } from "@/lib/import/structure/types";
import type { ProjectType } from "@/lib/project-config";

/** The subset of ProseMirror JSON this importer emits — the same shape lib/models/chapter.ts stores. */
export type TiptapMark = { type: "bold" | "italic" };
export type TiptapNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  text?: string;
  marks?: TiptapMark[];
};
export type TiptapDoc = { type: "doc"; content: TiptapNode[] };

/** A stretch of text sharing one style, before it becomes a Tiptap text node. */
export type Run = { text: string; bold: boolean; italic: boolean };

export type PieceAlign = "left" | "center";

export type FormatStats = {
  /** Source lines the piece was built from. */
  lines: number;
  /** Top-level blocks in the document. */
  blocks: number;
  /** Verse: paragraphs (stanzas) separated by blank space. Prose: paragraphs. */
  paragraphs: number;
  headings: number;
  /** Lines that were really one line wrapped by the PDF's width, put back together. */
  rejoinedWraps: number;
  /** Words split by a line-end hyphen, put back together. */
  dehyphenated: number;
  /** A few examples of rejoined wraps ("hoga" ← "…aata hi"), for the review screen and for checking the work. */
  wrapSamples: string[];
};

export type FormattedPiece = {
  index: number;
  kind: DetectedPiece["kind"];
  title: string;
  titleSource: DetectedPiece["titleSource"];
  /** Carried over from structure detection — how sure we are about WHERE this piece starts and ends. */
  confidence: Confidence;
  reasons: string[];
  startPage: number;
  endPage: number;
  /** How the text was rebuilt: line-by-line stanzas, or flowing paragraphs. */
  layout: "verse" | "prose";
  /** Verse is aligned as a whole. Prose carries its own per-paragraph alignment in `doc`. */
  align: PieceAlign;
  /** Share of this piece's (non-justified) lines that sat on the column's centre line. */
  centeredShare: number;
  doc: TiptapDoc;
  wordCount: number;
  stats: FormatStats;
  /** Things worth a look when reviewing THIS piece's formatting, in plain words. Informational — not a confidence change. */
  notes: string[];
};

export type FormattedBook = {
  version: 1;
  projectType: ProjectType;
  pieces: FormattedPiece[];
  /** Book-level observations in plain words. */
  notes: string[];
  totals: { pieces: number; words: number; rejoinedWraps: number; dehyphenated: number; centeredPieces: number };
};
