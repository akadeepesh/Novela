import type { PreparedLine, StripStyle } from "./lines";
import { lineRuns } from "./lines";
import { appendWrapped, isGapBefore } from "./join";
import { endsSentence } from "./text-rules";
import { heading, paragraph, runsToNodes } from "./tiptap";
import { wordCount } from "@/lib/import/structure/text-shapes";
import type { FormatStats, Run, TiptapNode } from "./types";

export type ProseResult = {
  nodes: TiptapNode[];
  firstLine: string;
  stats: Omit<FormatStats, "lines" | "blocks">;
};

export type ProseOptions = {
  bodySize: number;
  /** Scripts: every change of speaker / action / alignment is its own paragraph. */
  script: boolean;
};

const plainOf = (runs: Run[]) => runs.map((r) => r.text).join("").replace(/\s+/g, " ").trim();

function isIndented(pl: PreparedLine): boolean {
  if (pl.align === "centered") return false;
  const indent = pl.line.x - pl.col.left;
  return indent >= Math.max(pl.line.size * 0.8, 6) && indent <= pl.colWidth * 0.2;
}

function startsNewParagraph(prev: PreparedLine, cur: PreparedLine, opts: ProseOptions): boolean {
  if (opts.script) {
    return (
      prev.fill < 0.85 ||
      isGapBefore(prev, cur) ||
      prev.align !== cur.align ||
      Math.abs(prev.line.x - cur.line.x) > 6
    );
  }
  if (prev.page !== cur.page) {
    // A paragraph carried over a page break reads on mid-sentence from a full last line.
    const carriesOver = prev.fill >= 0.85 && !endsSentence(prev.line.text);
    return !carriesOver || isIndented(cur);
  }
  if (isGapBefore(prev, cur)) return true;
  if (isIndented(cur)) return true;
  if (prev.fill < 0.8 && endsSentence(prev.line.text)) return true;
  if ((prev.align === "centered") !== (cur.align === "centered")) return true;
  return false;
}

/** A heading is set noticeably larger than the body, or is a short bold line standing on its own. */
function isHeadingLine(pl: PreparedLine, prev: PreparedLine | undefined, opts: ProseOptions, strip: StripStyle): boolean {
  const words = wordCount(pl.line.text);
  if (opts.script) return false;
  if (words <= 14 && pl.line.size >= opts.bodySize * 1.15) return true;
  const wholeBold = pl.line.bold && !strip.bold;
  return wholeBold && words <= 8 && !endsSentence(pl.line.text) && (!prev || isGapBefore(prev, pl));
}

function headingLevel(size: number, bodySize: number): 2 | 3 {
  return size >= bodySize * 1.4 ? 2 : 3;
}

/**
 * Prose flows: lines are joined into paragraphs, using the gap above, a
 * first-line indent, or a short line that closes a sentence to tell where
 * one paragraph ends. Headings inside a chapter (not the chapter's own
 * title, which Step 4 already took out) become level 2 or 3.
 */
export function buildProse(pls: PreparedLine[], strip: StripStyle, opts: ProseOptions): ProseResult {
  const nodes: TiptapNode[] = [];
  let para: { runs: Run[]; lines: PreparedLine[] } | null = null;
  let head: { runs: Run[]; size: number; centered: boolean } | null = null;
  let firstLine = "";
  let rejoinedWraps = 0;
  let dehyphenated = 0;
  let headings = 0;
  const wrapSamples: string[] = [];

  const flushPara = () => {
    if (!para) return;
    const content = runsToNodes(para.runs);
    if (content.length) {
      const centered = para.lines.every((l) => l.align === "centered");
      nodes.push(paragraph(content, centered));
      if (!firstLine) firstLine = plainOf(para.runs);
    }
    para = null;
  };
  const flushHead = () => {
    if (!head) return;
    const content = runsToNodes(head.runs);
    if (content.length) {
      nodes.push(heading(headingLevel(head.size, opts.bodySize), content, head.centered));
      headings++;
    }
    head = null;
  };

  pls.forEach((pl, i) => {
    const prev = i > 0 ? pls[i - 1] : undefined;
    const runs = lineRuns(pl.line, strip);

    if (isHeadingLine(pl, prev, opts, strip)) {
      flushPara();
      if (head && Math.abs(head.size - pl.line.size) < 0.4 && prev && !isGapBefore(prev, pl)) {
        appendWrapped(head.runs, prev.line.text, pl.line.text, runs);
      } else {
        flushHead();
        head = { runs, size: pl.line.size, centered: pl.align === "centered" };
      }
      return;
    }
    flushHead();

    if (!para || !prev) {
      flushPara();
      para = { runs, lines: [pl] };
      return;
    }
    if (startsNewParagraph(prev, pl, opts)) {
      flushPara();
      para = { runs, lines: [pl] };
      return;
    }
    if (appendWrapped(para.runs, prev.line.text, pl.line.text, runs)) dehyphenated++;
    para.lines.push(pl);
    rejoinedWraps++;
    if (wrapSamples.length < 3) wrapSamples.push(`“${pl.line.text}” ← “…${prev.line.text.slice(-28)}”`);
  });
  flushPara();
  flushHead();

  return {
    nodes,
    firstLine,
    stats: { paragraphs: nodes.filter((n) => n.type === "paragraph").length, headings, rejoinedWraps, dehyphenated, wrapSamples },
  };
}
