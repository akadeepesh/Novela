import type { BackgroundQuality } from "./types";

/** The plan's guidance, as logic: ~25–40 pages, evenly spaced; below ~15 not worth trusting. */
export const MAX_SAMPLES = 40;
export const GOOD_SAMPLES = 25;
export const MIN_USEFUL_SAMPLES = 15;
/** Below this share of sampled pages matching the result, the background changes through the book. */
export const MIN_CONSISTENCY = 0.75;

/** Evenly spaced picks from the eligible pages — every page when there are fewer than `max`. */
export function pickSamplePages(eligible: number[], max = MAX_SAMPLES): number[] {
  if (eligible.length <= max) return [...eligible];
  const picks: number[] = [];
  for (let k = 0; k < max; k++) picks.push(eligible[Math.round((k * (eligible.length - 1)) / (max - 1))]);
  return picks;
}

export function qualityFromSamples(count: number, consistency: number | null): BackgroundQuality {
  if (consistency !== null && consistency < MIN_CONSISTENCY) return "poor";
  if (count >= GOOD_SAMPLES) return "good";
  if (count >= MIN_USEFUL_SAMPLES) return "fair";
  return "poor";
}

/** Pages with the book's usual size (± 1pt), leaving out the front cover when there is one. */
export function eligiblePages(sizes: { width: number; height: number }[], hasFrontCover: boolean): number[] {
  const tally = new Map<string, number>();
  for (const s of sizes) {
    const key = `${Math.round(s.width)}x${Math.round(s.height)}`;
    tally.set(key, (tally.get(key) ?? 0) + 1);
  }
  const usual = [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const pages: number[] = [];
  sizes.forEach((s, i) => {
    if (hasFrontCover && i === 0) return;
    if (`${Math.round(s.width)}x${Math.round(s.height)}` === usual) pages.push(i + 1);
  });
  return pages;
}
