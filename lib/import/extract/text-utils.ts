/** Pure text helpers for extraction. No pdf.js here, so they're cheap to test. */

const LIGATURES: Record<string, string> = {
  "\uFB00": "ff",
  "\uFB01": "fi",
  "\uFB02": "fl",
  "\uFB03": "ffi",
  "\uFB04": "ffl",
  "\uFB05": "st",
  "\uFB06": "st",
};

/**
 * Makes PDF text safe to use as manuscript text: ligature glyphs back to
 * letters (so "ﬁre" is searchable as "fire"), non-breaking spaces to plain
 * spaces, invisible soft hyphens gone. Deliberately not NFKC — that would
 * also rewrite things like ½ or ², which are the author's characters.
 */
export function normalizeText(raw: string): string {
  return raw
    .replace(/[\uFB00-\uFB06]/g, (c) => LIGATURES[c] ?? c)
    .replace(/[\u00A0\u202F\u2007]/g, " ")
    .replace(/\u00AD/g, "");
}

export type ParsedFontName = {
  /** Name without the 6-letter subset tag PDF producers prepend ("ABCDEF+"). */
  name: string;
  family: string;
  bold: boolean;
  italic: boolean;
};

/**
 * pdf.js doesn't expose bold/italic flags, so the font's own name is the
 * signal — which is also what the plan's "font name containing Bold/Italic"
 * rule relies on. Handles the PostScript-name styles seen in the wild:
 * "Calibri-BoldItalic", "TimesNewRomanPS-BoldMT", "Arial,Bold",
 * "CMBX10" (Computer Modern), "SourceSansPro-It", "Literata-ExtraBoldItalic".
 * Deliberately conservative: a regular face wrongly marked bold or italic
 * would silently restyle a whole manuscript, so only explicit style words count.
 */
export function parseFontName(raw: string | undefined | null): ParsedFontName {
  const name = (raw ?? "").replace(/^[A-Z]{6}\+/, "").trim();
  if (!name) return { name: "", family: "", bold: false, italic: false };

  const lower = name.toLowerCase();
  // "SemiBold" → ["semi","bold"], "TimesNewRomanPS-BoldMT" → [..., "bold","mt"]
  const tokens = name
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

  const bold = /bold|heavy|demi|cmbx|cmbsy/.test(lower) || tokens.some((t) => t === "black" || t === "bd");
  const italic =
    /italic|oblique|slanted|cmti|cmsl|kursiv/.test(lower) || tokens.some((t) => t === "it" || t === "ital");

  const family = name.split(/[-,]/)[0].replace(/PS(MT)?$/, "").trim() || name;
  return { name, family, bold, italic };
}

/** True for text that's only whitespace (after normalization). */
export function isBlank(s: string): boolean {
  return s.trim() === "";
}

const r1 = (n: number) => Math.round(n * 10) / 10;
/** Rounds to 0.1pt — plenty for layout, and keeps stored JSON small. */
export { r1 };

/** Strong right-to-left letters: Hebrew, Arabic, Syriac, Thaana, NKo, and Arabic presentation forms. */
const RTL_CHAR = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;
/** Characters that are unreadable: replacement glyph, or private-use (custom-encoded fonts). */
const GARBLED_CHAR = /[\uFFFD\uE000-\uF8FF]/g;

export function countRtl(s: string): number {
  let n = 0;
  for (const ch of s) if (RTL_CHAR.test(ch)) n++;
  return n;
}

export function countGarbled(s: string): number {
  return (s.match(GARBLED_CHAR) ?? []).length;
}

/** Visible characters — what "how much text is this" should mean. */
export function visibleLength(s: string): number {
  return s.replace(/\s+/g, "").length;
}
