import type { ProjectType } from "@/lib/project-config";
import type { FlatLine } from "./flatten";
import type { HeadingSignal, LineRef } from "./types";
import { headingNumber, median, visible, wordCount } from "./text-shapes";

export const MIN_HEADING_SCORE = 0.4;

const MAX_VISIBLE = 90;
const MAX_WORDS = 14;
const SIZE_BUCKET = 0.25;
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export type DetectedHeading = {
  ref: LineRef;
  text: string;
  score: number;
  number: number | null;
};

export type HeadingDetection = { signal: HeadingSignal; headings: DetectedHeading[] };

type PageContext = { bodySize: number; bodyBold: boolean; spacing: number };
type Pattern = HeadingSignal["pattern"];

const NUM = String.raw`(?:\d{1,3}|[ivxlcdm]{1,7}|(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty)(?:[\s-](?:one|two|three|four|five|six|seven|eight|nine))?|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)`;
// "Chapter 3", "CHAPTER THREE: The Storm", "Part II", "Book One" — a keyword followed by a number.
const CHAPTER_NUMBERED = new RegExp(String.raw`^(?:chapter|ch\.?|part|book|section|canto|act)\s+${NUM}\b`, "i");
// Stand-alone sections, kept short so a line of prose that merely starts with one of these words doesn't qualify.
const CHAPTER_STANDALONE = /^(?:prologue|epilogue|preface|foreword|introduction|afterword|interlude|author'?s note|acknowledg(?:e)?ments?)\b/i;
const BARE_NUMBER = new RegExp(String.raw`^${NUM}[.):]?$`, "i");
const NUMBER_THEN_TITLE = new RegExp(String.raw`^(?:\d{1,3}|[ivxlcdm]{1,7})[.):]\s+\S`, "i");
const EPISODE = /^(?:episode|ep\.?|script|video)\s*(?:#|no\.?)?\s*\d+/i;
const SLUGLINE = /^(?:int|ext|int\.?\/ext|ext\.?\/int|i\/e)[.\s/]/i;

/** What kind of heading phrase is this, and how strong a signal is the phrase itself? */
function patternOf(text: string, prom: number, type: ProjectType): { kind: Pattern; strength: number } | null {
  const t = text.trim();
  if (EPISODE.test(t)) return { kind: "episode", strength: type === "script-writing" ? 1 : 0.6 };
  if (type === "script-writing" && SLUGLINE.test(t)) return { kind: "slugline", strength: 1 };
  if (CHAPTER_NUMBERED.test(t)) return { kind: "chapter-word", strength: 1 };
  if (CHAPTER_STANDALONE.test(t) && wordCount(t) <= 4) return { kind: "chapter-word", strength: 0.9 };
  // A bare "7" or "VII" is only a heading if it *looks* like one — otherwise it's a page number or a stray figure.
  if (BARE_NUMBER.test(t) && prom >= 0.5) return { kind: "number", strength: 0.8 };
  if (NUMBER_THEN_TITLE.test(t) && prom >= 0.5) return { kind: "number", strength: 0.6 };
  return null;
}

function pageContexts(flat: FlatLine[]): Map<number, PageContext> {
  const byPage = new Map<number, FlatLine[]>();
  for (const fl of flat) byPage.set(fl.ref.page, [...(byPage.get(fl.ref.page) ?? []), fl]);

  const out = new Map<number, PageContext>();
  for (const [page, lines] of byPage) {
    const chars = new Map<number, number>();
    for (const l of lines) {
      const key = Math.round(l.line.size / SIZE_BUCKET) * SIZE_BUCKET;
      chars.set(key, (chars.get(key) ?? 0) + visible(l.line.text).length);
    }
    const bodySize = [...chars.entries()].sort((a, b) => b[1] - a[1])[0][0];
    const body = lines.filter((l) => Math.abs(l.line.size - bodySize) <= 0.5);
    const bodyBold = body.filter((l) => l.line.bold).length / (body.length || 1) >= 0.5;
    const gaps = body.map((l) => l.gapAbove).filter((g): g is number => g !== null && g > 0);
    out.set(page, { bodySize, bodyBold, spacing: gaps.length ? median(gaps) : bodySize * 1.3 });
  }
  return out;
}

type Candidate = DetectedHeading & { kind: Pattern; size: number; bold: boolean };

/**
 * Finds lines that announce a new section: "Chapter One", a bare "7", an
 * "EPISODE 2", an "INT. KITCHEN — DAY", or simply a line set noticeably
 * bigger or bolder than the text around it with space around it.
 *
 * "Bigger" is judged against the *same page's* text, not the whole book,
 * because some books (poems fitted to their page) change size every page —
 * in those, nothing is a heading just for being large.
 */
export function detectHeadings(flat: FlatLine[], type: ProjectType): HeadingDetection | null {
  const ctxs = pageContexts(flat);
  const candidates: Candidate[] = [];

  for (const fl of flat) {
    const text = fl.line.text.trim();
    if (visible(text).length === 0 || visible(text).length > MAX_VISIBLE || wordCount(text) > MAX_WORDS) continue;
    const ctx = ctxs.get(fl.ref.page);
    if (!ctx) continue;

    const ratio = fl.line.size / ctx.bodySize;
    const prom = Math.max(
      clamp01((ratio - 1.08) / 0.32),
      fl.line.bold && !ctx.bodyBold ? 0.7 : 0
    );

    const above = fl.firstOnPage ? 1 : clamp01(((fl.gapAbove ?? 0) / ctx.spacing - 1.3) / 1.2);
    const below = fl.gapBelow === null ? 1 : clamp01((fl.gapBelow / ctx.spacing - 1.3) / 1.2);
    const iso = Math.max(above, below * 0.8);

    const pat = patternOf(text, prom, type);
    const score = 0.4 * (pat?.strength ?? 0) + 0.35 * prom + 0.25 * iso;
    if (score < 0.5 || !((pat?.strength ?? 0) >= 0.6 || prom >= 0.6)) continue;

    candidates.push({
      ref: fl.ref,
      text: text.replace(/[:\s]+$/, "").replace(/\s+/g, " "),
      score,
      number: headingNumber(text),
      kind: pat?.kind ?? "styled",
      size: Math.round(fl.line.size / SIZE_BUCKET) * SIZE_BUCKET,
      bold: fl.line.bold,
    });
  }
  if (candidates.length === 0) return null;

  // ---- group into families (same size, same weight) and pick the one that is "the chapter headings"
  const families = new Map<string, Candidate[]>();
  for (const c of candidates) {
    const key = `${c.size}|${c.bold}`;
    families.set(key, [...(families.get(key) ?? []), c]);
  }
  const usable = [...families.values()].filter((f) => f.length >= 2);
  if (usable.length === 0) return null;

  const patterned = (f: Candidate[]) => f.filter((c) => c.kind !== "styled").length / f.length >= 0.5;
  const weight = (f: Candidate[]) => f.length * (f.reduce((s, c) => s + c.score, 0) / f.length);

  let chosen: Candidate[];
  const episodes = usable.filter((f) => f.every((c) => c.kind === "episode"));
  if (type === "script-writing" && episodes.length) {
    // For scripts an episode title outranks the scene headings inside it.
    chosen = episodes.sort((a, b) => weight(b) - weight(a))[0];
  } else {
    // A family built on real heading phrases beats a merely-big-and-bold one (subheadings must not outvote chapters).
    chosen = [...usable].sort((a, b) => Number(patterned(b)) - Number(patterned(a)) || weight(b) - weight(a))[0];
  }
  chosen = [...chosen].sort((a, b) => a.ref.page - b.ref.page || a.ref.index - b.ref.index);

  // ---- numbering: do the chapters count up?
  const numbers = chosen.map((c) => c.number);
  const numbered = numbers.filter((n) => n !== null).length;
  let consecutive = 0;
  const jumps: HeadingSignal["sequence"]["jumps"] = [];
  let prev: number | null = null;
  chosen.forEach((c, i) => {
    if (c.number !== null && prev !== null) {
      if (c.number === prev + 1) consecutive++;
      else jumps.push({ from: prev, to: c.number, before: i });
    }
    if (c.number !== null) prev = c.number;
  });

  // A heading with no keyword ("Chapter", "Episode") can't score above 0.6 on its own —
  // but the same big bold line recurring at the top of 25 pages is strong evidence by
  // sheer repetition. Let consistency stand in for the missing keyword.
  const keywordShare = chosen.filter((c) => c.kind !== "styled").length / chosen.length;
  const repetition = 0.4 * Math.min(1, (chosen.length - 1) / 6) * (1 - keywordShare);
  const avg = Math.min(1, chosen.reduce((s, c) => s + c.score, 0) / chosen.length + repetition);
  const countFactor = Math.min(1, chosen.length / 3);
  const seqFactor = numbered >= 3 ? 0.75 + 0.25 * (consecutive / (numbered - 1)) : 1;
  const score = avg * countFactor * seqFactor;

  const kinds = new Map<Pattern, number>();
  for (const c of chosen) kinds.set(c.kind, (kinds.get(c.kind) ?? 0) + 1);
  const pattern = [...kinds.entries()].sort((a, b) => b[1] - a[1])[0][0];

  if (score < MIN_HEADING_SCORE) return null;
  return {
    headings: chosen.map(({ ref, text, score: s, number }) => ({ ref, text, score: s, number })),
    signal: {
      pattern,
      style: { size: chosen[0].size, bold: chosen[0].bold },
      count: chosen.length,
      score: Math.round(score * 100) / 100,
      sequence: { numbered, consecutive, jumps },
      ignoredStyles: usable.length - 1,
    },
  };
}
