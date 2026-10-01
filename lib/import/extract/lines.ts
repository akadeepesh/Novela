import type { TextLine, TextSpan } from "./types";
import { countRtl, isBlank, normalizeText, r1, visibleLength } from "./text-utils";

/** One piece of text as pdf.js reports it, already converted to top-left page coordinates. */
export type RawRun = {
  text: string;
  /** Left edge of the run's box. */
  x: number;
  /** Baseline. */
  y: number;
  width: number;
  size: number;
  font: string;
  bold: boolean;
  italic: boolean;
  dir: "ltr" | "rtl";
  /** Font ascent/descent as fractions of size, when the PDF says. */
  ascent?: number;
  descent?: number;
};

/**
 * Two runs belong to one line when their baselines are within this fraction
 * of the larger font size. Loose enough for a superscript or a mixed-size
 * line, tight enough that ordinary line spacing (≥ ~1× size) never merges.
 */
const BASELINE_TOLERANCE = 0.4;
/** A horizontal gap wider than this fraction of the font size means "there was a space here". */
const SPACE_GAP = 0.2;
/** Runs within this many points of size are treated as the same size (PDF producers jitter). */
const SIZE_EPSILON = 0.15;

type Group = { runs: RawRun[]; meanY: number; maxSize: number };

function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * Rebuilds visual lines from loose runs.
 *
 * Why this isn't just "take pdf.js's order": a PDF stores text in whatever
 * order its producer wrote it, which is often not reading order (Canva and
 * some InDesign exports write words or whole lines shuffled). Position is
 * the truth, so runs are grouped by baseline, then ordered along the line.
 *
 * Whitespace is handled with care because it's where extractors go wrong:
 * pdf.js emits spaces as their own runs (in whichever font was active), and
 * sometimes emits no space at all, leaving only a gap. So spaces never start
 * a styled span (they'd create phantom bold/italic marks), and a missing
 * space is inferred from the gap.
 */
export function buildLines(runs: RawRun[], page: number): TextLine[] {
  const live = runs
    .map((r) => ({ ...r, text: normalizeText(r.text) }))
    .filter((r) => r.text.length > 0 && r.size > 0 && Number.isFinite(r.x) && Number.isFinite(r.y));

  // Top-to-bottom, then left-to-right, so each run lands next to its neighbours.
  const sorted = live.sort((a, b) => a.y - b.y || a.x - b.x);

  const groups: Group[] = [];
  for (const run of sorted) {
    const g = groups[groups.length - 1];
    if (g && Math.abs(run.y - g.meanY) <= BASELINE_TOLERANCE * Math.max(run.size, g.maxSize)) {
      g.runs.push(run);
      g.meanY += (run.y - g.meanY) / g.runs.length;
      g.maxSize = Math.max(g.maxSize, run.size);
    } else {
      groups.push({ runs: [run], meanY: run.y, maxSize: run.size });
    }
  }

  const lines: TextLine[] = [];
  for (const g of groups) {
    const line = buildLine(g.runs, page);
    if (line) lines.push(line);
  }
  return lines;
}

function buildLine(runs: RawRun[], page: number): TextLine | null {
  // A group made only of spaces (stray whitespace runs) isn't a line.
  if (runs.every((r) => isBlank(r.text))) return null;

  // Reading direction from the letters themselves.
  let rtlChars = 0;
  let ltrChars = 0;
  for (const r of runs) {
    if (isBlank(r.text)) continue;
    const rtl = Math.max(countRtl(r.text), r.dir === "rtl" ? visibleLength(r.text) : 0);
    rtlChars += rtl;
    ltrChars += visibleLength(r.text) - rtl;
  }
  const dir: "ltr" | "rtl" = rtlChars > ltrChars ? "rtl" : "ltr";

  // Along the line, in reading order: left→right, or right→left for RTL.
  const ordered =
    dir === "ltr"
      ? [...runs].sort((a, b) => a.x - b.x)
      : [...runs].sort((a, b) => b.x + b.width - (a.x + a.width));

  type Acc = TextSpan & { left: number; rightEdge: number };
  const spans: Acc[] = [];
  let edge: number | null = null; // where the previous run ended, along the reading direction
  // Where the last piece of real text (not whitespace) ended. pdf.js reports a
  // wide gap as a blank run carrying the gap's width, so the honest measure of
  // "how far apart are these two words" runs from ink to ink.
  let inkEdge: number | null = null;
  let maxGap = 0;

  for (const run of ordered) {
    const runLeft = run.x;
    const runRight = run.x + run.width;
    const last = spans[spans.length - 1];

    if (isBlank(run.text)) {
      // Whitespace belongs to whatever came before it; leading whitespace is
      // dropped. It never widens a span: only real ink defines where a line sits.
      if (last && !/\s$/.test(last.text)) last.text += " ";
      edge = dir === "ltr" ? runRight : runLeft;
      continue;
    }

    if (last && inkEdge !== null) {
      const inkGap = dir === "ltr" ? runLeft - inkEdge : inkEdge - runRight;
      if (inkGap > maxGap) maxGap = inkGap;
    }
    if (last && edge !== null) {
      const gap = dir === "ltr" ? runLeft - edge : edge - runRight;
      if (gap > SPACE_GAP * run.size && !/\s$/.test(last.text) && !/^\s/.test(run.text)) {
        last.text += " ";
      }
    }

    const sameStyle =
      last &&
      last.font === run.font &&
      Math.abs(last.size - run.size) <= SIZE_EPSILON &&
      last.bold === run.bold &&
      last.italic === run.italic;

    if (last && sameStyle) {
      last.text += run.text;
      last.left = Math.min(last.left, runLeft);
      last.rightEdge = Math.max(last.rightEdge, runRight);
    } else {
      spans.push({
        text: run.text,
        x: runLeft,
        width: run.width,
        font: run.font,
        size: run.size,
        bold: run.bold,
        italic: run.italic,
        left: runLeft,
        rightEdge: runRight,
      });
    }
    edge = dir === "ltr" ? runRight : runLeft;
    inkEdge = edge;
  }

  // Trim the line's ends and drop spans that trimmed away to nothing.
  if (spans.length) spans[0].text = spans[0].text.replace(/^\s+/, "");
  if (spans.length) spans[spans.length - 1].text = spans[spans.length - 1].text.replace(/\s+$/, "");
  const kept = spans.filter((s) => s.text.length > 0);
  if (kept.length === 0) return null;

  // Geometry and dominant style, weighted by how much text each span carries.
  const sizeChars = new Map<number, number>();
  for (const s of kept) {
    const key = r1(s.size);
    sizeChars.set(key, (sizeChars.get(key) ?? 0) + visibleLength(s.text));
  }
  const size = [...sizeChars.entries()].sort((a, b) => b[1] - a[1])[0][0];

  const lettered = kept.filter((s) => visibleLength(s.text) > 0);
  const y = median(runs.filter((r) => !isBlank(r.text)).map((r) => r.y));
  const ascent = runs.find((r) => r.ascent !== undefined)?.ascent;
  const descent = runs.find((r) => r.descent !== undefined)?.descent;
  // Guard against nonsense metrics: fall back to typical values.
  const asc = ascent !== undefined && ascent > 0.4 && ascent < 1.5 ? ascent : 0.8;
  const desc = descent !== undefined && descent < 0 && descent > -0.8 ? descent : -0.2;

  const outSpans: TextSpan[] = kept.map((s) => ({
    text: s.text,
    x: r1(s.left),
    width: r1(s.rightEdge - s.left),
    font: s.font,
    size: r1(s.size),
    bold: s.bold,
    italic: s.italic,
  }));

  return {
    page,
    text: outSpans.map((s) => s.text).join(""),
    spans: outSpans,
    x: r1(Math.min(...kept.map((s) => s.left))),
    right: r1(Math.max(...kept.map((s) => s.rightEdge))),
    y: r1(y),
    top: r1(y - asc * size),
    bottom: r1(y - desc * size),
    size,
    bold: lettered.length > 0 && lettered.every((s) => s.bold),
    italic: lettered.length > 0 && lettered.every((s) => s.italic),
    dir,
    maxGap: r1(maxGap),
  };
}
