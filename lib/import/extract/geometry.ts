import type { LineAlignment, TextBlock, TextLine } from "./types";

/**
 * Where a line sits relative to the page's reading column. Step 3 uses this
 * to describe a book; formatting reconstruction (centered paragraphs) reuses
 * it, so the definition lives in one place.
 *
 * Centering is judged against the column's own middle, not the page's: print
 * interiors mirror their margins (a wider inner gutter), so text centered in
 * its column sits several points off the page's true center.
 */
export function classifyAlignment(line: TextLine, block: TextBlock | null): LineAlignment {
  if (!block) return "other";
  const blockWidth = block.right - block.left;
  if (blockWidth <= 0) return "other";

  const tol = Math.max(3, blockWidth * 0.015);
  const indent = line.x - block.left;
  const flushLeft = Math.abs(indent) <= tol;
  const flushRight = Math.abs(line.right - block.right) <= tol;
  const centered = Math.abs((line.x + line.right) / 2 - (block.left + block.right) / 2) <= tol;

  // Flush on both edges: a justified line. (A first line with an ordinary
  // paragraph indent is also flush right and only slightly inset — same thing.)
  if (flushLeft && flushRight) return "full";
  if (flushRight && indent > 0 && indent <= blockWidth * 0.12) return "full";
  // Known limit: the widest centered line of a block *defines* the column, so
  // it is flush on both edges and lands in "full" above. Per-line alignment
  // is therefore evidence, not a verdict — decide centering for a whole poem
  // or page by its majority (formatting reconstruction does this).
  // On the column's own axis is centered — however wide. The widest centered
  // lines of a poem poke past a measured column and must not be mistaken for justified text.
  if (centered && !flushLeft) return "centered";
  if (flushLeft) return "left";
  if (flushRight) return "right";
  return "other";
}

export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return NaN;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.round((p / 100) * (sorted.length - 1))));
  return sorted[idx];
}

/**
 * The reading column from a set of body-text lines: the 5th/95th percentile
 * of their left and right edges, so a couple of stray indents or
 * overhanging lines don't stretch it. For centered text this lands on the
 * same axis as the lines themselves (the widest lines define both ends).
 * Null when there isn't enough text to say.
 */
export function measureBlock(lines: TextLine[], minLines = 8): TextBlock | null {
  if (lines.length < minLines) return null;
  const lefts = lines.map((l) => l.x).sort((a, b) => a - b);
  const rights = lines.map((l) => l.right).sort((a, b) => a - b);
  const left = percentile(lefts, 5);
  const right = percentile(rights, 95);
  return right > left ? { left, right } : null;
}

/** Odd and even pages are measured separately (mirrored margins); fall back to the other parity if one is missing. */
export function blockForPage(
  blocks: { odd: TextBlock | null; even: TextBlock | null },
  page: number
): TextBlock | null {
  const own = page % 2 === 1 ? blocks.odd : blocks.even;
  return own ?? blocks.odd ?? blocks.even;
}
