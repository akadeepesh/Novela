import type { ExtractedText } from "@/lib/import/extract/types";
import type { Confidence, DetectedPiece, StructureResult } from "./types";

const pct = (n: number) => `${Math.round(n * 100)}%`;
const CONF_LABEL: Record<Confidence, string> = { high: "HIGH  ", medium: "MEDIUM", low: "LOW   " };

function pageSpan(p: DetectedPiece): string {
  return p.startPage === p.endPage ? `p${p.startPage}` : `p${p.startPage}–${p.endPage}`;
}

/** "1-20,40" → [1..20, 40] (1-based piece numbers). */
export function parsePieceList(spec: string | null | undefined, count: number): number[] {
  if (!spec) return [];
  const out = new Set<number>();
  for (const part of spec.split(",")) {
    const m = part.trim().match(/^(\d+)(?:-(\d+))?$/);
    if (!m) continue;
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    for (let n = Math.min(a, b); n <= Math.max(a, b) && out.size < 300; n++) if (n >= 1 && n <= count) out.add(n);
  }
  return [...out].sort((a, b) => a - b);
}

/**
 * A readable account of where the book was cut and how sure we are, for
 * checking a real upload. (The review screen in step 10 is the designed
 * surface a person actually uses.)
 */
export function formatStructureReport(
  result: StructureResult,
  extracted: ExtractedText,
  opts: { fileName?: string; pieces?: number[]; detail?: boolean } = {}
): string {
  const out: string[] = [];
  const { pieces, signals } = result;
  const count = (c: Confidence) => pieces.filter((p) => p.confidence === c).length;

  out.push("KoraKagaj import — structure report");
  out.push(`${opts.fileName ? opts.fileName + " · " : ""}${result.projectType} · ${extracted.pageCount} pages`);
  out.push("");
  out.push(`METHOD    ${result.method}   ·   overall confidence ${result.confidence.toUpperCase()}`);

  if (signals.separator) {
    const s = signals.separator;
    out.push(
      `MARKER    “${s.sample}”  shape “${s.shape}”  ·  ${s.count}×  ·  role: ${s.role}  ·  score ${s.score}` +
        (result.method === "separator" ? "   ← used to split" : "   (not used to split)")
    );
    out.push(
      `          same size ${pct(s.consistency.size)} · same horizontal spot ${pct(s.consistency.x)} · same vertical spot ${pct(s.consistency.y)}  ·  ` +
        `lines per piece: median ${s.pieceLines.median}, min ${s.pieceLines.min}, max ${s.pieceLines.max}`
    );
  }
  if (signals.heading) {
    const h = signals.heading;
    out.push(
      `HEADINGS  ${h.count}× ${h.pattern}  ·  ${h.style.size}pt${h.style.bold ? " bold" : ""}  ·  score ${h.score}` +
        (result.method === "heading" ? "   ← used to split" : "   (not used to split)")
    );
    if (h.sequence.numbered >= 2) {
      out.push(
        `          numbered ${h.sequence.numbered}, counting up correctly ${h.sequence.consecutive}×` +
          (h.sequence.jumps.length ? `  ·  jumps: ${h.sequence.jumps.map((j) => `${j.from}→${j.to}`).join(", ")}` : "")
      );
    }
  }
  if (!signals.separator && !signals.heading) out.push("SIGNALS   none found");
  out.push(
    `REMOVED   ${result.furniture.filter((f) => f.kind === "separator").length} markers · ` +
      `${result.furniture.filter((f) => f.kind === "folio").length} page numbers · ` +
      `${result.furniture.filter((f) => f.kind === "running-head").length} running-head lines`
  );
  out.push(
    `PIECES    ${pieces.length}   (high ${count("high")} · medium ${count("medium")} · low ${count("low")})   ` +
      `${pieces.filter((p) => p.titleSource === "first-line").length} titled from their first line`
  );
  out.push("");
  out.push("NOTES");
  for (const n of result.notes) out.push(`  • ${n}`);

  // ---- which pieces to list
  const explicit = opts.pieces?.length ? opts.pieces : null;
  const flagged = pieces.filter((p) => p.confidence !== "high").map((p) => p.index + 1);
  const head = pieces.slice(0, 12).map((p) => p.index + 1);
  const tail = pieces.slice(-3).map((p) => p.index + 1);
  const shown = explicit ?? [...new Set([...head, ...flagged, ...tail])].sort((a, b) => a - b);

  const lineText = (ref: { page: number; index: number }) => extracted.pages[ref.page - 1]?.lines[ref.index]?.text ?? "";
  out.push("");
  out.push(explicit ? "PIECES (as requested)" : "PIECES (first 12, every one that needs a look, and the last 3 — use ?pieces=1-30 for others)");
  let prev = 0;
  for (const n of shown) {
    if (n - prev > 1 && prev !== 0) out.push("   …");
    prev = n;
    const p = pieces[n - 1];
    if (!p) continue;
    out.push(
      `  ${String(n).padStart(3)}  ${pageSpan(p).padEnd(8)} ${String(p.lines.length).padStart(3)} lines  ${CONF_LABEL[p.confidence]} ` +
        `${p.kind === "front-matter" ? "[front matter] " : ""}“${p.title}”${p.titleSource === "first-line" ? "  (from first line)" : ""}` +
        `${p.marker ? `   ⟂ ${p.marker}` : ""}`
    );
    for (const r of p.reasons) out.push(`            ↳ ${r}`);
    if (opts.detail && p.lines.length) {
      out.push(`            first: “${lineText(p.lines[0])}”`);
      out.push(`            last:  “${lineText(p.lines[p.lines.length - 1])}”`);
    }
  }
  return out.join("\n") + "\n";
}
