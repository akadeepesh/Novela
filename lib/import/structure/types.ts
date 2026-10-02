import type { ProjectType } from "@/lib/project-config";

/** Points at one line of extracted text: page (1-based) and index within that page's `lines`. */
export type LineRef = { page: number; index: number };

/**
 * How much to trust a detection. The review screen leans on this: "high"
 * pieces are shown as settled, "medium"/"low" ones are pointed out so the
 * person checks them first. Plain words on purpose — a number would imply a
 * precision these heuristics don't have.
 */
export type Confidence = "high" | "medium" | "low";

/**
 * Lines that are part of the page rather than the writing: page numbers,
 * running headers, and the divider/marker lines between pieces. They're
 * removed from every piece's content, and kept here so nothing is lost
 * silently (and so the review step can show what was dropped).
 */
export type FurnitureKind = "folio" | "running-head" | "separator";
export type FurnitureLine = { ref: LineRef; kind: FurnitureKind; text: string };

export type StructureMethod = "separator" | "heading" | "none";

export type SeparatorSignal = {
  /** The marker's text with digits as "#", e.g. "— # —" or "* * *". */
  shape: string;
  /** One real example, digits intact. */
  sample: string;
  count: number;
  /**
   * after  = closes the piece before it (a "— 4 —" at the foot of a poem)
   * before = opens the piece after it
   * inline = a divider sitting between pieces
   */
  role: "after" | "before" | "inline";
  score: number;
  /** Shares (0–1) of occurrences matching the typical size / horizontal position / vertical position. */
  consistency: { size: number; x: number; y: number };
  pieceLines: { median: number; min: number; max: number };
};

export type HeadingSignal = {
  pattern: "chapter-word" | "number" | "episode" | "slugline" | "styled";
  /** Typical size of these headings, and whether they're bold. */
  style: { size: number; bold: boolean };
  count: number;
  score: number;
  /** For numbered headings: how many carried a number, how many followed the previous one by exactly 1, and the jumps. */
  sequence: { numbered: number; consecutive: number; jumps: { from: number; to: number; before: number }[] };
  /** Other heading-like styles that were seen but not used (e.g. "Part" pages above chapters). */
  ignoredStyles: number;
};

export type DetectedPiece = {
  /** 0-based position in reading order. */
  index: number;
  /** "front-matter" = text before the first heading (title page, dedication…). */
  kind: "piece" | "front-matter";
  title: string;
  /** "first-line" and "fallback" titles are suggestions the person should be told about. */
  titleSource: "heading" | "first-line" | "fallback";
  /** The heading line itself, when there is one (not repeated in `lines`). */
  titleRef?: LineRef;
  /** The marker text that closed/opened it, e.g. "— 4 —". */
  marker?: string;
  /** Body lines in order, with page furniture and the title line removed. */
  lines: LineRef[];
  startPage: number;
  endPage: number;
  confidence: Confidence;
  /** Plain-language reasons the piece is not "high". Empty when it is. */
  reasons: string[];
};

export type StructureResult = {
  version: 1;
  projectType: ProjectType;
  method: StructureMethod;
  confidence: Confidence;
  pieces: DetectedPiece[];
  furniture: FurnitureLine[];
  signals: {
    separator: SeparatorSignal | null;
    heading: HeadingSignal | null;
    /** Page numbers found and removed: how many, and the text shape. */
    folio: { shape: string; count: number } | null;
    runningHeads: { text: string; count: number }[];
  };
  /** Result-level observations, in plain language. */
  notes: string[];
};
