import { endsSentence, isLineEndHyphen, startsCaseless, startsLower } from "./text-rules";
import type { PreparedLine } from "./lines";
import type { Run } from "./types";

/** A line this close to the column's full width was probably cut by the page, not by the writer. */
const NEAR_FULL = 0.88;
/** Scripts without letter case: a short line under a near-full one is treated as the leftover of a wrap. */
const CASELESS_ORPHAN_MAX_FILL = 0.4;
/** More than this many ordinary line-steps apart is a stanza / paragraph gap, not the next line. */
const GAP_FACTOR = 1.3;

export function isGapBefore(prev: PreparedLine, cur: PreparedLine): boolean {
  if (prev.page !== cur.page) return true;
  return cur.line.y - prev.line.y > cur.step * GAP_FACTOR;
}

/**
 * Is `cur` the rest of the line `prev` that the PDF's width cut short?
 *
 * Needs all of: the previous line ran (nearly) edge to edge, it didn't end a
 * sentence, they are the same size with ordinary spacing between them, and
 * the next line carries on in lower case ("…aata hi" / "hoga"). Writers
 * capitalise the start of a line of verse, so a capital means a new line even
 * when it is short — a missed rejoin is one Enter key to fix in the editor;
 * a wrongly merged line silently changes the poem.
 * Scripts without case (Devanagari, Arabic…) can't use that signal, so a short
 * leftover stands in for it there. Across a page break only the case signal counts.
 */
export function isWrapContinuation(prev: PreparedLine, cur: PreparedLine): boolean {
  if (prev.fill < NEAR_FULL) return false;
  if (Math.abs(prev.line.size - cur.line.size) > 0.4) return false;
  if (endsSentence(prev.line.text)) return false;
  const samePage = prev.page === cur.page;
  if (samePage && isGapBefore(prev, cur)) return false;
  if (startsLower(cur.line.text)) return true;
  return samePage && startsCaseless(cur.line.text) && cur.fill <= CASELESS_ORPHAN_MAX_FILL;
}

/**
 * Appends `next` to an in-progress line: a space between them, or — when the
 * typesetter split a word with a hyphen at the line end — straight on with the
 * hyphen removed. Returns true when a word was put back together.
 */
export function appendWrapped(into: Run[], prevText: string, nextText: string, next: Run[]): boolean {
  if (isLineEndHyphen(prevText, nextText)) {
    const last = into[into.length - 1];
    if (last) last.text = last.text.replace(/-\s*$/, "");
    into.push(...next);
    return true;
  }
  const last = into[into.length - 1];
  if (last) last.text = last.text.replace(/\s+$/, "") + " ";
  into.push(...next);
  return false;
}
