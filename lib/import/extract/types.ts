/**
 * Output shapes for text extraction. Plain JSON-serializable data with no
 * server-only imports, so later steps (structure detection, formatting
 * reconstruction, the review UI) can all consume it.
 *
 * Coordinates: PDF points (1/72in), origin at the TOP-LEFT of the page as it
 * is displayed (page rotation and crop box already applied), y growing
 * downward — the way a reader thinks about a page, not PDF's bottom-up space.
 */

/** A stretch of text in one font at one size, with where it sits on the page. */
export type TextSpan = {
  text: string;
  /** Left edge. */
  x: number;
  width: number;
  /** Resolved font name without the PDF's subset tag, e.g. "Literata-BoldItalic". */
  font: string;
  size: number;
  bold: boolean;
  italic: boolean;
};

/** One visual line of text, reconstructed from every run sharing a baseline. */
export type TextLine = {
  /** 1-based PDF page number. */
  page: number;
  /** The line's plain text, spans joined, ligatures expanded, trimmed. */
  text: string;
  spans: TextSpan[];
  x: number;
  right: number;
  /** Baseline. */
  y: number;
  top: number;
  bottom: number;
  /** The size most of the line's characters are set in. */
  size: number;
  /** Every letter on the line is bold / italic (partial styling lives on `spans`). */
  bold: boolean;
  italic: boolean;
  /** Dominant reading direction. */
  dir: "ltr" | "rtl";
  /** Widest empty stretch between two pieces of text on this line, in points. A very wide one suggests columns or a table. */
  maxGap: number;
};

export type PageText = {
  page: number;
  width: number;
  height: number;
  lines: TextLine[];
  /** What was read but deliberately not turned into lines — counted, never silent. */
  skipped: {
    /** Runs not running horizontally on the displayed page (sideways / upside-down / watermark text). */
    offAxis: number;
    /** Runs lying wholly outside the visible page. */
    offPage: number;
  };
};

export type FontUsage = {
  name: string;
  family: string;
  bold: boolean;
  italic: boolean;
  chars: number;
  lines: number;
};

export type SizeUsage = { size: number; chars: number; lines: number };

/** Where the reading column sits on a page — used to judge centered / flush / indented. */
export type TextBlock = { left: number; right: number };

export type BookProfile = {
  pageCount: number;
  /** Pages that produced at least one line of text. */
  pagesWithText: number;
  emptyPages: number[];
  lineCount: number;
  charCount: number;
  /** The size most characters are set in — what "normal text" is in this book. */
  bodySize: number | null;
  bodyFont: string | null;
  /** Up to 8 most-used sizes, biggest share first. Headings show up as the larger ones. */
  sizes: SizeUsage[];
  fonts: FontUsage[];
  /** Median baseline-to-baseline distance between consecutive body lines. */
  lineSpacing: number | null;
  /**
   * Reading column per page parity. Print interiors mirror their margins, so
   * odd and even pages are measured separately; `null` where there wasn't
   * enough text to measure.
   */
  blocks: { odd: TextBlock | null; even: TextBlock | null };
  alignment: Record<LineAlignment, number>;
  rtlShare: number;
  /** Share of body lines with an unusually wide internal gap — a hint of multi-column or tabular layout, which v1 doesn't handle. */
  wideGapShare: number;
  /** Share of characters that came out as replacement/private-use glyphs — a sign of a font whose text can't be read. */
  garbledShare: number;
  offAxisRuns: number;
  offPageRuns: number;
  /** Fonts whose real name couldn't be read (their bold/italic can't be known). */
  unresolvedFonts: number;
};

export type LineAlignment = "full" | "centered" | "left" | "right" | "other";

export type ExtractedText = {
  version: 1;
  pageCount: number;
  pages: PageText[];
  profile: BookProfile;
  elapsedMs: number;
};

export type ExtractProgress = { page: number; total: number; lines: number };
