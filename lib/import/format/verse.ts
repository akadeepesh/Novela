import type { PreparedLine, StripStyle } from "./lines";
import { lineRuns } from "./lines";
import { appendWrapped, isGapBefore, isWrapContinuation } from "./join";
import { linesToInline, paragraph } from "./tiptap";
import type { FormatStats, PieceAlign, Run, TiptapNode } from "./types";

export type VerseResult = {
  nodes: TiptapNode[];
  align: PieceAlign;
  centeredShare: number;
  /** Plain text of the first line as it ended up, wraps rejoined — the basis for an untitled poem's title. */
  firstLine: string;
  stats: Omit<FormatStats, "lines" | "blocks" | "headings">;
};

/** At least this share of a poem's not-edge-to-edge lines sitting on the column's centre line makes it a centered poem. */
const CENTERED_SHARE = 0.6;

const plain = (runs: Run[]) => runs.map((r) => r.text).join("").replace(/\s+/g, " ").trim();

/**
 * Verse keeps the writer's line breaks: each line stays a line (a hard break
 * inside one paragraph), and a stanza is a paragraph. Two things from the PDF
 * are undone: a line the page's width cut in two is put back together, and
 * the page break inside a poem becomes a stanza break — never a silent join.
 */
export function buildVerse(pls: PreparedLine[], strip: StripStyle): VerseResult {
  const stanzas: Run[][][] = [];
  let stanza: Run[][] = [];
  let cur: Run[] | null = null;
  let rejoinedWraps = 0;
  let dehyphenated = 0;
  const wrapSamples: string[] = [];

  pls.forEach((pl, i) => {
    const runs = lineRuns(pl.line, strip);
    if (i === 0 || !cur) {
      cur = runs;
      return;
    }
    const prev = pls[i - 1];
    if (isWrapContinuation(prev, pl)) {
      if (appendWrapped(cur, prev.line.text, pl.line.text, runs)) dehyphenated++;
      rejoinedWraps++;
      if (wrapSamples.length < 3) wrapSamples.push(`“${pl.line.text}” ← “…${prev.line.text.slice(-28)}”`);
      return;
    }
    stanza.push(cur);
    if (isGapBefore(prev, pl)) {
      stanzas.push(stanza);
      stanza = [];
    }
    cur = runs;
  });
  if (cur) stanza.push(cur);
  if (stanza.length) stanzas.push(stanza);

  const edgeToEdge = (pl: PreparedLine) => pl.align === "full";
  const judged = pls.filter((pl) => !edgeToEdge(pl));
  const centeredLines = judged.filter((pl) => pl.align === "centered").length;
  const centeredShare = judged.length ? centeredLines / judged.length : 0;
  const align: PieceAlign = judged.length >= 2 && centeredShare >= CENTERED_SHARE ? "center" : "left";

  const nodes = stanzas
    .map((st) => paragraph(linesToInline(st), align === "center"))
    .filter((n) => n.content?.length);

  return {
    nodes,
    align,
    centeredShare,
    firstLine: stanzas.length ? plain(stanzas[0][0]) : "",
    stats: { paragraphs: nodes.length, rejoinedWraps, dehyphenated, wrapSamples },
  };
}
