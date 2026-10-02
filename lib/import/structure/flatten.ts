import type { PageText, TextLine } from "@/lib/import/extract/types";
import type { LineRef } from "./types";
import { refKey } from "./text-shapes";

/** One content line in book order, with the page context detectors keep needing. */
export type FlatLine = {
  ref: LineRef;
  line: TextLine;
  pageWidth: number;
  pageHeight: number;
  /** First / last content line on its page (furniture doesn't count). */
  firstOnPage: boolean;
  lastOnPage: boolean;
  /** Baseline distance to the previous content line on the same page; null for the first. */
  gapAbove: number | null;
  gapBelow: number | null;
};

/**
 * Every line that could be content, in reading order: pages in order, lines
 * top to bottom. `skip` removes lines already identified as something else
 * (page numbers, markers) so later detectors never see them.
 */
export function flatten(pages: PageText[], excludedPages: Set<number>, skip: Set<string>): FlatLine[] {
  const out: FlatLine[] = [];
  for (const page of pages) {
    if (excludedPages.has(page.page)) continue;
    const kept: { index: number; line: TextLine }[] = [];
    page.lines.forEach((line, index) => {
      if (!skip.has(refKey({ page: page.page, index }))) kept.push({ index, line });
    });
    kept.forEach(({ index, line }, i) => {
      const prev = kept[i - 1]?.line;
      const next = kept[i + 1]?.line;
      out.push({
        ref: { page: page.page, index },
        line,
        pageWidth: page.width,
        pageHeight: page.height,
        firstOnPage: i === 0,
        lastOnPage: i === kept.length - 1,
        gapAbove: prev ? line.y - prev.y : null,
        gapBelow: next ? next.y - line.y : null,
      });
    });
  }
  return out;
}
