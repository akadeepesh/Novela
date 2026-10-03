import type { FlatLine } from "./flatten";
import { median } from "./text-shapes";

export type PagePerPieceSignal = {
  /** Pages (not counting a cover) that carry any text of their own. */
  textPages: number;
  totalPages: number;
  /** Share of those pages whose text stops well short of the bottom of the page — the look of verse, not of running prose. */
  partialShare: number;
  /** Pages whose text runs right down to the bottom: a poem may carry on over the page. */
  fullPages: number[];
  score: number;
};

/**
 * Poetry collections very often give every poem a page to itself and put
 * nothing between poems — no "— 4 —", no asterisks. Then there is no marker
 * to find, but the pages themselves say so: nearly every page has text, and
 * on most of them it stops well short of the bottom (a poem), where a page
 * of prose would run to the foot.
 *
 * Only used when nothing better — a repeating marker, a heading — was found,
 * and never as a certainty: a poem that runs onto a second page can't be told
 * from two short ones, so full pages are called out and the person checks.
 */
export function detectPagePerPiece(flat: FlatLine[], totalPages: number): PagePerPieceSignal | null {
  const byPage = new Map<number, FlatLine[]>();
  for (const f of flat) {
    const list = byPage.get(f.ref.page) ?? [];
    list.push(f);
    byPage.set(f.ref.page, list);
  }
  const textPages = byPage.size;
  if (textPages < 3 || totalPages === 0) return null;
  const textShare = textPages / totalPages;
  if (textShare < 0.8) return null;

  const steps: number[] = [];
  const bottoms: { page: number; bottom: number }[] = [];
  for (const [page, lines] of byPage) {
    lines.forEach((l) => l.gapAbove !== null && l.gapAbove > 0 && steps.push(l.gapAbove));
    bottoms.push({ page, bottom: lines[lines.length - 1].line.bottom });
  }
  const step = steps.length ? median(steps) : 20;
  const bodyBottom = Math.max(...bottoms.map((b) => b.bottom));
  const fullPages = bottoms.filter((b) => b.bottom >= bodyBottom - step * 1.5).map((b) => b.page);
  const partialShare = 1 - fullPages.length / textPages;
  if (partialShare < 0.6) return null;

  return { textPages, totalPages, partialShare, fullPages, score: 0.5 * textShare + 0.5 * partialShare };
}
