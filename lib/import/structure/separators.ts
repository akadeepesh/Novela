import type { FlatLine } from "./flatten";
import type { LineRef, SeparatorSignal } from "./types";
import { letterRatio, median, shapeOf, visible, wordCount } from "./text-shapes";

/** A marker is short: "— 14 —", "* * *", "❦", "~". */
const MAX_VISIBLE_CHARS = 16;
const MAX_WORDS = 4;
/** …and mostly not letters, which separates a marker from a one-word line of verse like "hoga". */
const MAX_LETTER_RATIO = 0.5;
/** Below this the evidence is too thin to split a person's book on. */
export const MIN_SEPARATOR_SCORE = 0.45;

export type SeparatorDetection = {
  signal: SeparatorSignal;
  /** Every line that is one of these markers, to be taken out of the content. */
  occurrences: LineRef[];
};

const share = (n: number, total: number) => (total === 0 ? 0 : n / total);

/**
 * Looks for a short, mostly-non-letter line that keeps coming back — the
 * "— 14 —" at the foot of each poem, a row of asterisks between pieces —
 * and decides whether it is what divides this book.
 *
 * Several kinds of evidence are weighed together, none decisive alone:
 *  - how often it recurs (two could be coincidence; fifty is a pattern),
 *  - whether it looks like one repeated *template* (same size, same spot),
 *  - whether its role is clear (always the last line on a page, say),
 *  - whether the pieces it would make are plausible (not one giant piece).
 *
 * Page numbers must be removed before this runs (see furniture.ts): they
 * recur on every page and would otherwise win.
 */
export function detectSeparator(flat: FlatLine[]): SeparatorDetection | null {
  const groups = new Map<string, number[]>(); // shape → positions in `flat`
  flat.forEach((fl, pos) => {
    const t = fl.line.text;
    const v = visible(t);
    if (v.length < 1 || v.length > MAX_VISIBLE_CHARS) return;
    if (wordCount(t) > MAX_WORDS) return;
    if (letterRatio(t) > MAX_LETTER_RATIO) return;
    const shape = shapeOf(t);
    groups.set(shape, [...(groups.get(shape) ?? []), pos]);
  });

  let best: { det: SeparatorDetection; score: number } | null = null;

  for (const [shape, positions] of groups) {
    const n = positions.length;
    if (n < 2) continue;
    const members = positions.map((p) => flat[p]);

    // ---- is it one repeated template?
    const medSize = median(members.map((m) => m.line.size));
    const medX = median(members.map((m) => (m.line.x + m.line.right) / 2 / m.pageWidth));
    const medY = median(members.map((m) => m.line.y / m.pageHeight));
    const sameSize = share(members.filter((m) => Math.abs(m.line.size - medSize) <= 0.3).length, n);
    const sameX = share(
      members.filter((m) => Math.abs((m.line.x + m.line.right) / 2 / m.pageWidth - medX) <= 0.025).length,
      n
    );
    const sameY = share(members.filter((m) => Math.abs(m.line.y / m.pageHeight - medY) <= 0.02).length, n);

    // ---- what role does it play?
    const lastShare = share(members.filter((m) => m.lastOnPage).length, n);
    const firstShare = share(members.filter((m) => m.firstOnPage).length, n);
    const role: SeparatorSignal["role"] = lastShare >= 0.8 ? "after" : firstShare >= 0.8 ? "before" : "inline";
    const anchored = role !== "inline";

    // ---- would the pieces it makes be sane?
    const segments: number[] = [];
    const cuts = positions;
    if (role === "before") {
      for (let i = 0; i < cuts.length; i++) {
        const end = i + 1 < cuts.length ? cuts[i + 1] : flat.length;
        segments.push(end - cuts[i] - 1);
      }
    } else {
      segments.push(cuts[0]);
      for (let i = 1; i < cuts.length; i++) segments.push(cuts[i] - cuts[i - 1] - 1);
    }
    const real = segments.filter((s) => s > 0);
    const medLen = median(real);
    const maxLen = real.length ? Math.max(...real) : 0;
    const minLen = real.length ? Math.min(...real) : 0;
    const total = real.reduce((a, b) => a + b, 0) || 1;
    let plausibility = 1;
    if (n >= 4 && maxLen / total > 0.5) plausibility = 0.3; // one giant piece: the marker isn't really dividing anything
    else if (medLen < 1.5) plausibility = 0.5; // a marker between every line isn't a divider

    const score =
      0.35 * Math.min(1, (n - 1) / 6) +
      0.25 * ((sameSize + sameX + (anchored ? sameY : 1)) / 3) +
      0.2 * (anchored ? Math.max(lastShare, firstShare) : 0.6) +
      0.2 * plausibility;

    if (!best || score > best.score || (score === best.score && n > best.det.signal.count)) {
      best = {
        score,
        det: {
          occurrences: members.map((m) => m.ref),
          signal: {
            shape,
            sample: members[0].line.text,
            count: n,
            role,
            score: Math.round(score * 100) / 100,
            consistency: {
              size: Math.round(sameSize * 100) / 100,
              x: Math.round(sameX * 100) / 100,
              y: Math.round(sameY * 100) / 100,
            },
            pieceLines: { median: medLen, min: minLen, max: maxLen },
          },
        },
      };
    }
  }

  return best && best.score >= MIN_SEPARATOR_SCORE ? best.det : null;
}
