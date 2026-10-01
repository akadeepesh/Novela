import type {
  BookProfile,
  FontUsage,
  LineAlignment,
  PageText,
  SizeUsage,
  TextLine,
} from "./types";
import { blockForPage, classifyAlignment, measureBlock } from "./geometry";
import { countGarbled, parseFontName, visibleLength } from "./text-utils";

const SIZE_BUCKET = 0.25;
/** An internal gap wider than this many em starts to look like a column break. */
const WIDE_GAP_EM = 2.5;
const bucket = (size: number) => Math.round(size / SIZE_BUCKET) * SIZE_BUCKET;

function median(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * Summarizes how a book is typeset — what "normal text" looks like, what the
 * bigger sizes are, where the reading column sits — so later steps can judge
 * each line against the book it came from instead of against hard-coded
 * numbers. A 14pt line is a heading in one book and body text in another.
 */
export function buildProfile(pages: PageText[], unresolvedFonts: number): BookProfile {
  const allLines = pages.flatMap((p) => p.lines);

  // ---- sizes: char-weighted, bucketed so 11.04 and 10.98 count as one size
  const sizeAgg = new Map<number, SizeUsage>();
  let charCount = 0;
  let garbled = 0;
  for (const line of allLines) {
    for (const span of line.spans) {
      const chars = visibleLength(span.text);
      charCount += chars;
      const key = bucket(span.size);
      const u = sizeAgg.get(key) ?? { size: key, chars: 0, lines: 0 };
      u.chars += chars;
      sizeAgg.set(key, u);
    }
    garbled += countGarbled(line.text);
    const lineKey = bucket(line.size);
    const u = sizeAgg.get(lineKey);
    if (u) u.lines += 1;
  }
  const sizes = [...sizeAgg.values()].sort((a, b) => b.chars - a.chars).slice(0, 8);
  const bodySize = sizes.length ? sizes[0].size : null;

  const isBody = (l: TextLine) =>
    bodySize !== null && Math.abs(l.size - bodySize) <= Math.max(0.5, bodySize * 0.04);
  const bodyLines = allLines.filter(isBody);

  // ---- fonts
  const fontAgg = new Map<string, FontUsage>();
  for (const line of allLines) {
    const seen = new Set<string>();
    for (const span of line.spans) {
      const parsed = parseFontName(span.font);
      const key = span.font || "(unknown)";
      const u =
        fontAgg.get(key) ??
        { name: key, family: parsed.family || key, bold: span.bold, italic: span.italic, chars: 0, lines: 0 };
      u.chars += visibleLength(span.text);
      if (!seen.has(key)) {
        u.lines += 1;
        seen.add(key);
      }
      fontAgg.set(key, u);
    }
  }
  const fonts = [...fontAgg.values()].sort((a, b) => b.chars - a.chars);

  // The body font: whichever font carries most of the body-sized text.
  const bodyFontChars = new Map<string, number>();
  for (const line of bodyLines) {
    for (const span of line.spans) {
      if (Math.abs(span.size - (bodySize ?? 0)) > Math.max(0.5, (bodySize ?? 0) * 0.04)) continue;
      bodyFontChars.set(span.font, (bodyFontChars.get(span.font) ?? 0) + visibleLength(span.text));
    }
  }
  const bodyFont = [...bodyFontChars.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  // ---- line spacing: distance between consecutive body lines on a page
  const gaps: number[] = [];
  if (bodySize) {
    for (const page of pages) {
      const body = page.lines.filter(isBody);
      for (let i = 1; i < body.length; i++) {
        const gap = body[i].y - body[i - 1].y;
        if (gap > bodySize * 0.6 && gap < bodySize * 2.6) gaps.push(gap);
      }
    }
  }
  const lineSpacing = median(gaps);

  // ---- reading column per page parity
  const oddBody = pages.filter((p) => p.page % 2 === 1).flatMap((p) => p.lines.filter(isBody));
  const evenBody = pages.filter((p) => p.page % 2 === 0).flatMap((p) => p.lines.filter(isBody));
  const blocks = { odd: measureBlock(oddBody), even: measureBlock(evenBody) };

  // ---- alignment of body lines against their own page's column
  const counts: Record<LineAlignment, number> = { full: 0, centered: 0, left: 0, right: 0, other: 0 };
  for (const page of pages) {
    const block = blockForPage(blocks, page.page);
    for (const line of page.lines) {
      if (isBody(line)) counts[classifyAlignment(line, block)]++;
    }
  }
  const aligned = bodyLines.length || 1;
  const alignment = Object.fromEntries(
    (Object.keys(counts) as LineAlignment[]).map((k) => [k, counts[k] / aligned])
  ) as Record<LineAlignment, number>;

  // Justified word gaps are a fraction of the font size; columns and tables leave gaps of several em.
  const wideGaps = bodySize ? bodyLines.filter((l) => l.maxGap > bodySize * WIDE_GAP_EM).length : 0;

  const emptyPages = pages.filter((p) => p.lines.length === 0).map((p) => p.page);

  return {
    pageCount: pages.length,
    pagesWithText: pages.length - emptyPages.length,
    emptyPages,
    lineCount: allLines.length,
    charCount,
    bodySize,
    bodyFont,
    sizes,
    fonts,
    lineSpacing: lineSpacing === null ? null : Math.round(lineSpacing * 10) / 10,
    blocks: {
      odd: blocks.odd && { left: Math.round(blocks.odd.left * 10) / 10, right: Math.round(blocks.odd.right * 10) / 10 },
      even: blocks.even && { left: Math.round(blocks.even.left * 10) / 10, right: Math.round(blocks.even.right * 10) / 10 },
    },
    alignment,
    wideGapShare: bodyLines.length ? wideGaps / bodyLines.length : 0,
    rtlShare: allLines.length ? allLines.filter((l) => l.dir === "rtl").length / allLines.length : 0,
    garbledShare: charCount ? garbled / charCount : 0,
    offAxisRuns: pages.reduce((n, p) => n + p.skipped.offAxis, 0),
    offPageRuns: pages.reduce((n, p) => n + p.skipped.offPage, 0),
    unresolvedFonts,
  };
}
