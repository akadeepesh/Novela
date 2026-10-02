/** Small pure helpers for judging what kind of line a piece of text is. */

/** Digits → "#", whitespace collapsed: "— 14 —" and "— 4 —" share one shape. */
export function shapeOf(text: string): string {
  return text.replace(/\d+/g, "#").replace(/\s+/g, " ").trim();
}

export function visible(text: string): string {
  return text.replace(/\s+/g, "");
}

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Share of visible characters that are letters. Markers like "— 4 —" or "* * *" are ~0; prose is ~1. */
export function letterRatio(text: string): number {
  const v = [...visible(text)];
  if (v.length === 0) return 0;
  return v.filter((ch) => /\p{L}/u.test(ch)).length / v.length;
}

/** First run of digits in a line, e.g. 14 from "— 14 —". */
export function firstInteger(text: string): number | null {
  const m = text.match(/\d+/);
  return m ? Number(m[0]) : null;
}

const WORD_NUMBERS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60,
  seventy: 70, eighty: 80, ninety: 90,
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10,
};

function romanToInt(s: string): number | null {
  if (!/^[ivxlcdm]+$/i.test(s)) return null;
  const v: Record<string, number> = { i: 1, v: 5, x: 10, l: 50, c: 100, d: 500, m: 1000 };
  const str = s.toLowerCase();
  let total = 0;
  for (let i = 0; i < str.length; i++) {
    const cur = v[str[i]];
    const next = v[str[i + 1]] ?? 0;
    total += cur < next ? -cur : cur;
  }
  return total > 0 && total < 400 ? total : null;
}

/**
 * The chapter number a heading carries, if any: "Chapter 12", "CHAPTER TWELVE",
 * "XII", "12.", "Part Two", "Chapter Twenty-One". Null when there isn't one.
 */
export function headingNumber(text: string): number | null {
  const cleaned = text
    .trim()
    .replace(/^(chapter|ch\.?|part|book|section|episode|ep\.?|canto|act)\s*/i, "")
    .replace(/[.:)\-–—]+\s.*$/, "")
    .replace(/[.:)]+$/, "")
    .trim();
  if (/^\d{1,3}$/.test(cleaned)) return Number(cleaned);
  const roman = romanToInt(cleaned);
  if (roman !== null) return roman;
  const parts = cleaned.toLowerCase().split(/[\s-]+/);
  if (parts.length && parts.every((p) => p in WORD_NUMBERS)) {
    return parts.reduce((sum, p) => sum + WORD_NUMBERS[p], 0);
  }
  return null;
}

export function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export const refKey = (r: { page: number; index: number }) => `${r.page}:${r.index}`;
