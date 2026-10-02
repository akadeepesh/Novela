import type { ExtractedText, TextLine } from "./types";
import { blockForPage, classifyAlignment } from "./geometry";

const pct = (n: number) => `${Math.round(n * 100)}%`;
const n1 = (n: number) => (Math.round(n * 10) / 10).toFixed(1);

/** Line text with partial styling shown inline: **bold**, _italic_, **_both_**. */
function inlineStyled(line: TextLine): string {
  if (line.spans.length === 1) return line.text;
  return line.spans
    .map((s) => {
      const t = s.text;
      const core = t.trim();
      if (!core) return t;
      const lead = t.slice(0, t.length - t.trimStart().length);
      const trail = t.slice(t.trimEnd().length);
      if (s.bold && s.italic) return `${lead}**_${core}_**${trail}`;
      if (s.bold) return `${lead}**${core}**${trail}`;
      if (s.italic) return `${lead}_${core}_${trail}`;
      return t;
    })
    .join("");
}

/** "1,2,50-52" → [1,2,50,51,52]; out-of-range numbers dropped. */
export function parsePageList(spec: string | null | undefined, pageCount: number): number[] {
  if (!spec) return [];
  const out = new Set<number>();
  for (const part of spec.split(",")) {
    const m = part.trim().match(/^(\d+)(?:-(\d+))?$/);
    if (!m) continue;
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    for (let p = Math.min(a, b); p <= Math.max(a, b) && out.size < 200; p++) {
      if (p >= 1 && p <= pageCount) out.add(p);
    }
  }
  return [...out].sort((a, b) => a - b);
}

/**
 * A human-readable account of what extraction found — how the book is
 * typeset, then a line-by-line look at chosen pages. For developers and for
 * checking a real upload against its PDF; the review screen a person sees
 * in step 10 is a separate, designed surface.
 */
/** True when no single size describes the book — text is sized per page (typical of poems fitted to their page). */
export function sizesVaryByPage(result: ExtractedText): boolean {
  const { pageSizes } = result.profile;
  if (result.pageCount < 10) return false;
  const common = pageSizes.filter((s) => s.pages / result.profile.pagesWithText >= 0.1);
  return common.length >= 3;
}

export function formatExtractionReport(
  result: ExtractedText,
  opts: { fileName?: string; pages?: number[] } = {}
): string {
  const { profile: p } = result;
  const out: string[] = [];

  out.push("KoraKagaj import — text extraction report");
  out.push(
    `${opts.fileName ? opts.fileName + " · " : ""}${result.pageCount} pages · ${p.lineCount.toLocaleString("en")} lines · ` +
      `${p.charCount.toLocaleString("en")} characters · ${(result.elapsedMs / 1000).toFixed(1)}s`
  );
  out.push("");

  out.push("HOW THE BOOK IS SET");
  out.push(
    `  body text     ${p.bodySize !== null ? n1(p.bodySize) + "pt" : "—"}  ${p.bodyFont ?? "—"}` +
      (p.lineSpacing ? `  · line spacing ${n1(p.lineSpacing)}pt` : "") +
      (sizesVaryByPage(result) ? "  (varies by page — see NOTES)" : "")
  );
  const pageW = result.pages[0]?.width;
  out.push(
    `  reading column${pageW ? ` (page ${n1(pageW)}pt wide)` : ""}` +
      `   odd pages: ${p.blocks.odd ? `${n1(p.blocks.odd.left)} → ${n1(p.blocks.odd.right)}` : "—"}` +
      `   even pages: ${p.blocks.even ? `${n1(p.blocks.even.left)} → ${n1(p.blocks.even.right)}` : "—"}`
  );
  out.push(
    `  body lines    centered ${pct(p.alignment.centered)} · left ${pct(p.alignment.left)} · ` +
      `full width ${pct(p.alignment.full)} · right ${pct(p.alignment.right)} · other ${pct(p.alignment.other)}`
  );
  out.push("");

  out.push("SIZES (share of characters)");
  for (const s of p.sizes) {
    const share = p.charCount ? s.chars / p.charCount : 0;
    out.push(`  ${n1(s.size).padStart(5)}pt  ${pct(share).padStart(4)}  ${String(s.lines).padStart(5)} lines${s.size === p.bodySize ? "   ← body" : ""}`);
  }
  out.push("");

  out.push("FONTS");
  for (const f of p.fonts.slice(0, 10)) {
    const style = [f.bold ? "bold" : "", f.italic ? "italic" : ""].filter(Boolean).join(" ") || "regular";
    const share = p.charCount ? f.chars / p.charCount : 0;
    out.push(`  ${pct(share).padStart(4)}  ${f.name.padEnd(34)} ${style}`);
  }
  if (p.fonts.length > 10) out.push(`  … and ${p.fonts.length - 10} more`);
  out.push("");

  const warnings: string[] = [];
  if (sizesVaryByPage(result)) {
    const top = p.pageSizes.slice(0, 4).map((s) => `${n1(s.size)}pt on ${s.pages} pages`).join(", ");
    warnings.push(`Text size changes from page to page (${top}) — typical of poems sized to fit their page. Size alone can't identify headings in this book`);
  }
  if (p.emptyPages.length) warnings.push(`${p.emptyPages.length} page(s) with no text: ${p.emptyPages.slice(0, 15).join(", ")}${p.emptyPages.length > 15 ? "…" : ""}`);
  if (p.offAxisRuns) warnings.push(`${p.offAxisRuns} piece(s) of sideways/upside-down text were left out`);
  if (p.offPageRuns) warnings.push(`${p.offPageRuns} piece(s) of text lying outside the page were left out`);
  if (p.garbledShare > 0.005) warnings.push(`${pct(p.garbledShare)} of characters are unreadable glyphs — the PDF's fonts may not map to real text`);
  if (p.unresolvedFonts) warnings.push(`${p.unresolvedFonts} font(s) couldn't be identified, so their bold/italic is unknown`);
  if (p.wideGapShare > 0.1) warnings.push(`${pct(p.wideGapShare)} of lines have a wide gap in the middle — this may be a multi-column or table layout, which import doesn't handle well yet`);
  if (p.rtlShare > 0.01) warnings.push(`${pct(p.rtlShare)} of lines read right-to-left`);
  out.push("NOTES");
  out.push(warnings.length ? warnings.map((w) => `  • ${w}`).join("\n") : "  (nothing unusual)");

  const shown = opts.pages?.length ? opts.pages : [];
  for (const pageNumber of shown) {
    const page = result.pages[pageNumber - 1];
    if (!page) continue;
    const block = blockForPage(p.blocks, pageNumber);
    out.push("");
    out.push(`── PAGE ${pageNumber} ── ${n1(page.width)}×${n1(page.height)}pt · ${page.lines.length} lines`);
    for (const line of page.lines) {
      const flags = `${line.bold ? "B" : "·"}${line.italic ? "I" : "·"}`;
      const align = classifyAlignment(line, block);
      out.push(
        `  y=${n1(line.y).padStart(6)}  x=${n1(line.x).padStart(6)}→${n1(line.right).padStart(6)}  ` +
          `${n1(line.size).padStart(5)}pt  ${flags}  ${align.padEnd(8)} ${line.dir === "rtl" ? "[rtl] " : ""}${inlineStyled(line)}`
      );
    }
  }
  return out.join("\n") + "\n";
}
