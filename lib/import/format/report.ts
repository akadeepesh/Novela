import type { FormattedBook, FormattedPiece, TiptapDoc, TiptapNode } from "./types";

const CONF: Record<string, string> = { high: "HIGH  ", medium: "MEDIUM", low: "LOW   " };
const WIDTH = 60;

function inline(nodes: TiptapNode[] | undefined): string {
  if (!nodes) return "";
  return nodes
    .map((n) => {
      if (n.type === "hardBreak") return "\n";
      const t = n.text ?? "";
      const bold = n.marks?.some((m) => m.type === "bold");
      const italic = n.marks?.some((m) => m.type === "italic");
      return bold && italic ? `***${t}***` : bold ? `**${t}**` : italic ? `*${t}*` : t;
    })
    .join("");
}

/** A piece's Tiptap document as readable text: centered blocks are padded to the middle, headings get #. */
export function renderDoc(doc: TiptapDoc): string {
  const blocks = doc.content.map((n) => {
    const centered = (n.attrs as { textAlign?: string } | undefined)?.textAlign === "center";
    const prefix = n.type === "heading" ? `${"#".repeat(Number((n.attrs as { level?: number }).level ?? 2))} ` : "";
    return (prefix + inline(n.content))
      .split("\n")
      .map((l) => (centered ? " ".repeat(Math.max(0, Math.floor((WIDTH - l.length) / 2))) + l : l))
      .join("\n");
  });
  return blocks.join("\n\n");
}

const span = (p: FormattedPiece) => (p.startPage === p.endPage ? `p${p.startPage}` : `p${p.startPage}–${p.endPage}`);

/**
 * A readable account of how each piece was rebuilt, for checking a real
 * upload. (The review screen in step 10 is the designed surface people use.)
 */
export function formatFormatReport(
  book: FormattedBook,
  opts: { fileName?: string; pieces?: number[]; pages?: number } = {}
): string {
  const out: string[] = [];
  const t = book.totals;
  out.push("KoraKagaj import — formatting report");
  out.push(`${opts.fileName ? opts.fileName + " · " : ""}${book.projectType}`);
  out.push("");
  out.push(
    `BOOK     ${t.pieces} pieces · ${t.words.toLocaleString("en-US")} words · ${t.rejoinedWraps} wrapped lines rejoined · ${t.dehyphenated} hyphenated words repaired · ${t.centeredPieces} centered`
  );
  for (const n of book.notes) out.push(`NOTE     ${n}`);
  out.push("");

  const chosen = opts.pieces ?? [];
  if (chosen.length) {
    for (const n of chosen) {
      const p = book.pieces[n - 1];
      if (!p) continue;
      out.push(`── PIECE ${n} · ${span(p)} · ${p.layout}${p.layout === "verse" ? ", " + p.align : ""} · ${p.wordCount} words ──`);
      out.push(`TITLE    ${p.title}${p.titleSource !== "heading" ? `   (from ${p.titleSource === "first-line" ? "its first line" : "a fallback"})` : ""}`);
      for (const note of p.notes) out.push(`         ${note}`);
      out.push("");
      out.push(renderDoc(p.doc));
      out.push("");
    }
    return out.join("\n");
  }

  out.push("PIECES   (add ?pieces=7 or ?pieces=1-10 to read them as rebuilt)");
  for (const p of book.pieces) {
    out.push(
      `  ${String(p.index + 1).padStart(3)}  ${span(p).padEnd(7)}  ${p.layout}${p.layout === "verse" ? "/" + p.align.padEnd(6) : "       "}  ${String(p.stats.lines).padStart(3)} lines → ${String(p.stats.blocks).padStart(2)} block${p.stats.blocks === 1 ? " " : "s"}  ${p.stats.rejoinedWraps ? `${p.stats.rejoinedWraps} rejoined` : "          "}  ${p.title.slice(0, 44)}`
    );
  }

  const samples = book.pieces.flatMap((p) => p.stats.wrapSamples.map((s) => `  piece ${String(p.index + 1).padStart(3)}  ${s}`));
  if (samples.length) {
    out.push("");
    out.push("REJOINED LINES — each shows the leftover ← the line it was put back onto (first few per piece)");
    out.push(...samples.slice(0, 60));
    if (samples.length > 60) out.push(`  … and ${samples.length - 60} more`);
  }
  return out.join("\n");
}
