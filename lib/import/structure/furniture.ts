import type { PageText } from "@/lib/import/extract/types";
import type { FurnitureLine } from "./types";
import { firstInteger, letterRatio, refKey, shapeOf } from "./text-shapes";

const TOP_ZONE = 0.12;
const BOTTOM_ZONE = 0.88;
/** A running head/foot must repeat on at least this share of pages (and 4+ times). */
const MIN_PAGE_SHARE = 0.2;
const MIN_OCCURRENCES = 4;
/** Share of occurrences whose number tracks the page number for it to count as a page number. */
const FOLIO_TRACKING = 0.8;

export type FurnitureResult = {
  furniture: FurnitureLine[];
  folio: { shape: string; count: number } | null;
  runningHeads: { text: string; count: number }[];
};

type Hit = { page: number; index: number; text: string; zone: "top" | "bottom" };

/**
 * Finds the parts of a page that aren't the writing: page numbers and
 * running headers/footers. Only the top and bottom margins are searched, and
 * only text that repeats across many pages qualifies.
 *
 * The hard part is telling a *page number* from a *marker between pieces*:
 * "— 4 —" at the foot of every page could be either. The tell is whether the
 * number follows the pages. A page number goes 4, 5, 6 as pages go 4, 5, 6;
 * a poem marker goes 4, 8, 14 — unrelated to the page — and must NOT be
 * thrown away here, because it's the very thing that splits the book.
 */
export function detectFurniture(pages: PageText[], excludedPages: Set<number>): FurnitureResult {
  const candidates = pages.filter((p) => !excludedPages.has(p.page) && p.lines.length > 0);
  const pageTotal = candidates.length;
  const furniture: FurnitureLine[] = [];
  const seen = new Set<string>();
  let folio: FurnitureResult["folio"] = null;
  const runningHeads: FurnitureResult["runningHeads"] = [];
  if (pageTotal === 0) return { furniture, folio, runningHeads };

  // Collect margin lines.
  const hits: Hit[] = [];
  for (const page of candidates) {
    page.lines.forEach((line, index) => {
      const rel = line.y / page.height;
      const zone = rel <= TOP_ZONE ? "top" : rel >= BOTTOM_ZONE ? "bottom" : null;
      if (zone) hits.push({ page: page.page, index, text: line.text, zone });
    });
  }

  const add = (h: Hit, kind: FurnitureLine["kind"]) => {
    const key = refKey(h);
    if (seen.has(key)) return;
    seen.add(key);
    furniture.push({ ref: { page: h.page, index: h.index }, kind, text: h.text });
  };

  // ---- page numbers: same shape in the same margin, number tracking the page
  const byShape = new Map<string, Hit[]>();
  for (const h of hits) {
    if (!/\d/.test(h.text) || letterRatio(h.text) > 0.5) continue;
    const key = `${h.zone}|${shapeOf(h.text)}`;
    byShape.set(key, [...(byShape.get(key) ?? []), h]);
  }
  for (const [key, group] of byShape) {
    if (group.length < MIN_OCCURRENCES || group.length / pageTotal < MIN_PAGE_SHARE) continue;
    const offsets = group.map((h) => (firstInteger(h.text) ?? NaN) - h.page);
    const counts = new Map<number, number>();
    for (const d of offsets) if (Number.isFinite(d)) counts.set(d, (counts.get(d) ?? 0) + 1);
    const top = Math.max(0, ...counts.values());
    if (top / group.length >= FOLIO_TRACKING) {
      for (const h of group) add(h, "folio");
      const shape = key.split("|")[1];
      if (!folio || group.length > folio.count) folio = { shape, count: group.length };
    }
  }

  // ---- running heads/feet: the same words, again and again, in the margin
  const byText = new Map<string, Hit[]>();
  for (const h of hits) {
    if (letterRatio(h.text) <= 0.5) continue;
    const key = `${h.zone}|${h.text.trim().toLowerCase()}`;
    byText.set(key, [...(byText.get(key) ?? []), h]);
  }
  for (const group of byText.values()) {
    if (group.length < MIN_OCCURRENCES || group.length / pageTotal < MIN_PAGE_SHARE) continue;
    for (const h of group) add(h, "running-head");
    runningHeads.push({ text: group[0].text.trim(), count: group.length });
  }

  return { furniture, folio, runningHeads };
}
