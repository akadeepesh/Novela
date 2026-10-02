import type { ExtractedText, LineAlignment, TextBlock, TextLine } from "@/lib/import/extract/types";
import { blockForPage, classifyAlignment } from "@/lib/import/extract/geometry";
import { median } from "@/lib/import/structure/text-shapes";
import type { LineRef } from "@/lib/import/structure/types";
import type { Run } from "./types";

/** A source line plus everything about its page that formatting needs to judge it. */
export type PreparedLine = {
  line: TextLine;
  page: number;
  col: TextBlock;
  colWidth: number;
  /** Typical baseline-to-baseline distance on this page, for telling a stanza/paragraph gap from ordinary spacing. */
  step: number;
  align: LineAlignment;
  /** How much of the reading column this line's ink spans (1 = edge to edge). */
  fill: number;
};

/** Which of bold / italic is just "how this book is set" and should not become a mark. */
export type StripStyle = { bold: boolean; italic: boolean };

/**
 * A book set entirely in a bold or italic face (some print templates do)
 * would otherwise come back as a wall of bold. When nearly every character
 * has the style, it's the body style, not emphasis.
 */
export function bodyStyleToStrip(extracted: ExtractedText): StripStyle {
  const fonts = extracted.profile.fonts;
  const total = fonts.reduce((n, f) => n + f.chars, 0);
  if (total === 0) return { bold: false, italic: false };
  const share = (pick: (f: (typeof fonts)[number]) => boolean) => fonts.filter(pick).reduce((n, f) => n + f.chars, 0) / total;
  return { bold: share((f) => f.bold) >= 0.85, italic: share((f) => f.italic) >= 0.85 };
}

function pageStep(lines: TextLine[]): number {
  const gaps: number[] = [];
  for (let i = 1; i < lines.length; i++) {
    const a = lines[i - 1];
    const b = lines[i];
    const gap = b.y - a.y;
    if (gap > 0 && gap < Math.max(a.size, b.size) * 3 && Math.abs(a.size - b.size) < 0.6) gaps.push(gap);
  }
  if (gaps.length) return median(gaps);
  const sizes = lines.map((l) => l.size);
  return (sizes.length ? median(sizes) : 12) * 1.8;
}

export function prepareLines(extracted: ExtractedText, refs: LineRef[]): PreparedLine[] {
  const stepCache = new Map<number, number>();
  const colCache = new Map<number, TextBlock>();
  return refs.map((ref) => {
    const page = extracted.pages[ref.page - 1];
    const line = page.lines[ref.index];
    if (!stepCache.has(ref.page)) stepCache.set(ref.page, pageStep(page.lines));
    if (!colCache.has(ref.page)) {
      const measured = blockForPage(extracted.profile.blocks, ref.page);
      const fallback = page.lines.length
        ? { left: Math.min(...page.lines.map((l) => l.x)), right: Math.max(...page.lines.map((l) => l.right)) }
        : { left: 0, right: page.width };
      colCache.set(ref.page, measured ?? fallback);
    }
    const col = colCache.get(ref.page)!;
    const colWidth = Math.max(1, col.right - col.left);
    return {
      line,
      page: ref.page,
      col,
      colWidth,
      step: stepCache.get(ref.page)!,
      align: classifyAlignment(line, col),
      fill: (line.right - line.x) / colWidth,
    };
  });
}

export function lineRuns(line: TextLine, strip: StripStyle): Run[] {
  return line.spans.map((s) => ({ text: s.text, bold: s.bold && !strip.bold, italic: s.italic && !strip.italic }));
}
