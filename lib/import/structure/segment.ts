import type { Confidence, DetectedPiece, HeadingSignal, LineRef, SeparatorSignal, StructureMethod } from "./types";
import { median, refKey } from "./text-shapes";

/** The book's content in reading order, with the divider markers still in place so pieces can be cut at them. */
export type StreamItem =
  | { kind: "line"; ref: LineRef; text: string }
  | { kind: "marker"; ref: LineRef; text: string };

export type SegmentInput = {
  stream: StreamItem[];
  method: StructureMethod;
  baseConfidence: Confidence;
  separator?: SeparatorSignal | null;
  /** Headings, in reading order, with the number each carries (if any). */
  headings?: { ref: LineRef; text: string; number: number | null }[];
  headingSignal?: HeadingSignal | null;
  /** For method "page": pages whose text runs to the bottom, so a poem may continue past them. */
  fullPages?: Set<number>;
  fallbackTitle: string;
  /** What to call a section whose heading is only a number: "Chapter" → "Chapter 5". */
  bareNumberLabel: string;
};

const ORDER: Record<Confidence, number> = { low: 0, medium: 1, high: 2 };
const lower = (a: Confidence, b: Confidence): Confidence => (ORDER[a] <= ORDER[b] ? a : b);

/** "5", "VII", "Five", "5." — a heading that is just a number tells a chapter list nothing. */
const BARE_NUMBER_HEADING = /^(?:\d{1,3}|[ivxlcdm]{1,7}|(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)(?:[\s-](?:one|two|three|four|five|six|seven|eight|nine))?)[.):]?$/i;

/** A suggested title from a piece's first line: trimmed, capped at a word boundary. */
export function titleFromFirstLine(text: string, max = 60): string {
  const t = text.replace(/\s+/g, " ").trim().replace(/[,;:\s]+$/, "");
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const at = cut.lastIndexOf(" ");
  return (at > max * 0.6 ? cut.slice(0, at) : cut).replace(/[,;:\s]+$/, "") + "…";
}

type Draft = {
  kind: DetectedPiece["kind"];
  titleRef?: LineRef;
  title?: string;
  marker?: string;
  lines: { ref: LineRef; text: string }[];
  headingIndex?: number;
};

export function segment(input: SegmentInput): DetectedPiece[] {
  const drafts: Draft[] = [];

  if (input.method === "separator") {
    const role = input.separator?.role ?? "after";
    let current: Draft = { kind: "piece", lines: [] };
    let pendingMarker: string | undefined;
    const close = (marker?: string) => {
      if (current.lines.length > 0) drafts.push({ ...current, marker: marker ?? current.marker });
      current = { kind: "piece", lines: [] };
    };
    for (const item of input.stream) {
      if (item.kind === "line") {
        current.lines.push({ ref: item.ref, text: item.text });
      } else if (role === "before") {
        close();
        current.marker = item.text;
        pendingMarker = item.text;
      } else {
        close(item.text);
      }
    }
    void pendingMarker;
    close();
  } else if (input.method === "heading") {
    const headingAt = new Map(
      (input.headings ?? []).map((h, i) => [refKey(h.ref), { ...h, i }] as const)
    );
    let current: Draft = { kind: "front-matter", lines: [] };
    let started = false;
    const close = () => {
      if (started || current.lines.length > 0) drafts.push(current);
    };
    for (const item of input.stream) {
      if (item.kind === "marker") continue; // decoration between pieces
      const h = headingAt.get(refKey(item.ref));
      if (h) {
        close();
        started = true;
        current = { kind: "piece", titleRef: h.ref, title: h.text, headingIndex: h.i, lines: [] };
      } else {
        current.lines.push({ ref: item.ref, text: item.text });
      }
    }
    close();
  } else if (input.method === "page") {
    const byPage = new Map<number, Draft>();
    for (const item of input.stream) {
      if (item.kind !== "line") continue;
      const d = byPage.get(item.ref.page) ?? { kind: "piece" as const, lines: [] };
      d.lines.push({ ref: item.ref, text: item.text });
      byPage.set(item.ref.page, d);
    }
    drafts.push(...[...byPage.entries()].sort((a, b) => a[0] - b[0]).map(([, d]) => d));
  } else {
    const lines = input.stream.filter((i) => i.kind === "line").map((i) => ({ ref: i.ref, text: i.text }));
    if (lines.length > 0) drafts.push({ kind: "piece", lines });
  }

  // ---- turn drafts into pieces, with titles
  const pieces: DetectedPiece[] = drafts.map((d, index) => {
    const first = d.lines[0];
    const pages = [d.titleRef?.page, ...d.lines.map((l) => l.ref.page)].filter((p): p is number => p !== undefined);
    const base: DetectedPiece = {
      index,
      kind: d.kind,
      title:
        d.kind === "front-matter"
          ? "Front matter"
          : d.title
            ? BARE_NUMBER_HEADING.test(d.title)
              ? `${input.bareNumberLabel} ${d.title.replace(/[.):]+$/, "")}`
              : d.title
            : first
              ? titleFromFirstLine(first.text)
              : input.fallbackTitle,
      titleSource: d.title ? "heading" : d.kind === "front-matter" ? "fallback" : first ? "first-line" : "fallback",
      lines: d.lines.map((l) => l.ref),
      startPage: pages.length ? Math.min(...pages) : 1,
      endPage: pages.length ? Math.max(...pages) : 1,
      confidence: input.baseConfidence,
      reasons: [],
    };
    if (d.titleRef) base.titleRef = d.titleRef;
    if (d.marker) base.marker = d.marker;
    return base;
  });
  if (input.method === "none" && pieces[0]) {
    pieces[0].title = input.fallbackTitle;
    pieces[0].titleSource = "fallback";
  }

  assessPieces(pieces, drafts, input);
  return pieces;
}

/** Per-piece confidence: start from how sure the book-level signal was, then mark down anything odd about this piece. */
function assessPieces(pieces: DetectedPiece[], drafts: Draft[], input: SegmentInput) {
  const note = (p: DetectedPiece, level: Confidence, reason: string) => {
    p.confidence = lower(p.confidence, level);
    p.reasons.push(reason);
  };

  const real = pieces.filter((p) => p.kind === "piece");
  const med = median(real.map((p) => p.lines.length));

  pieces.forEach((p, i) => {
    const d = drafts[i];
    // When the book-level signal itself is only middling, say so on every piece it produced.
    // (Piece-specific problems below are added on top.)
    if (p.confidence !== "high" && input.method !== "none" && p.kind === "piece") {
      p.reasons.push(
        input.method === "heading"
          ? input.headingSignal?.pattern === "styled"
            ? "Picked out by how it looks (larger or bolder) alone, with no “Chapter”-style wording to confirm it."
            : "The headings in this book were only partly consistent."
          : input.method === "page"
            ? "Taken as one page, one piece — nothing in the book marks where pieces begin and end."
            : "The repeating marker was only partly consistent across the book."
      );
    }
    if (p.kind === "front-matter") {
      note(p, "low", "Text before the first heading — a title page or dedication, perhaps?");
      return;
    }
    if (input.method === "none") {
      note(p, "low", "No dependable way to tell where one piece ends and the next begins, so this is the whole book.");
      return;
    }
    if (p.lines.length === 0) {
      note(p, "low", "Nothing between this heading and the next.");
    }
    if (input.method === "page") {
      const page = p.startPage;
      if (input.fullPages?.has(page)) note(p, "medium", "This page is full to the bottom — the piece may carry on onto the next page.");
      else if (input.fullPages?.has(page - 1)) note(p, "medium", "The page before is full to the bottom, so this may be the rest of that piece.");
    }
    if (input.method === "separator" && input.separator?.role === "after" && !p.marker) {
      note(p, "low", "No closing marker after this one — it may be unfinished, or run into the next piece.");
    }
    if (input.method === "separator" && input.separator?.role === "before" && !p.marker) {
      note(p, "low", "No opening marker before this one.");
    }
    if (input.method === "heading" && d.headingIndex !== undefined) {
      const jump = input.headingSignal?.sequence.jumps.find((j) => j.before === d.headingIndex);
      if (jump) note(p, "medium", `Numbering jumps from ${jump.from} to ${jump.to} here — is a chapter missing?`);
    }
    if (real.length >= 6 && med >= 4) {
      if (p.lines.length > med * 3 && p.lines.length > med + 8) {
        note(p, "medium", "Much longer than the others — it may be several pieces run together.");
      } else if (p.lines.length <= 1 && p.lines.length > 0) {
        note(p, "medium", "Only one line — possibly a stray line rather than a piece of its own.");
      }
    }
  });
}
