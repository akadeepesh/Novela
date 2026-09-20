/**
 * A small, self-contained word-level diff (classic LCS backtrack) —
 * enough to show "what changed between these two versions" without
 * pulling in a diffing library for something this contained.
 */

export type DiffPart = { type: "equal" | "insert" | "delete"; text: string };

function tokenize(text: string): string[] {
  // Split on whitespace but keep it attached to the following token, so
  // re-joining tokens reproduces the original spacing exactly.
  return text.match(/\S+\s*|\s+/g) ?? [];
}

export function diffWords(oldText: string, newText: string): DiffPart[] {
  const a = tokenize(oldText);
  const b = tokenize(newText);

  // Word-level LCS is O(n·m) in both time and memory. For long chapters
  // that table gets huge (a 5,000-word chapter is a 25M-cell table), so
  // above a safety threshold we diff by paragraph instead — coarser, but
  // stays fast and bounded regardless of chapter length.
  if (a.length * b.length > 2_000_000) {
    return diffParagraphs(oldText, newText);
  }

  return diffTokens(a, b);
}

function diffParagraphs(oldText: string, newText: string): DiffPart[] {
  const a = oldText.split(/\n+/);
  const b = newText.split(/\n+/);
  return diffTokens(
    a.map((p) => p + "\n"),
    b.map((p) => p + "\n")
  );
}

function diffTokens(a: string[], b: string[]): DiffPart[] {
  const n = a.length;
  const m = b.length;

  // LCS length table.
  const lengths: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lengths[i][j] =
        a[i] === b[j] ? lengths[i + 1][j + 1] + 1 : Math.max(lengths[i + 1][j], lengths[i][j + 1]);
    }
  }

  // Backtrack, merging consecutive same-type tokens into single parts.
  const parts: DiffPart[] = [];
  function push(type: DiffPart["type"], text: string) {
    const last = parts[parts.length - 1];
    if (last && last.type === type) last.text += text;
    else parts.push({ type, text });
  }

  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      push("equal", a[i]);
      i++;
      j++;
    } else if (lengths[i + 1][j] >= lengths[i][j + 1]) {
      push("delete", a[i]);
      i++;
    } else {
      push("insert", b[j]);
      j++;
    }
  }
  while (i < n) {
    push("delete", a[i]);
    i++;
  }
  while (j < m) {
    push("insert", b[j]);
    j++;
  }

  return parts;
}
