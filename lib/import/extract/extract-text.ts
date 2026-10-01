import "server-only";
import { Util, openPdf, type PDFPageProxy } from "@/lib/import/pdfjs";
import { buildLines, type RawRun } from "./lines";
import { buildProfile } from "./profile";
import { parseFontName } from "./text-utils";
import type { ExtractProgress, ExtractedText, PageText } from "./types";

type FontMeta = { name: string; bold: boolean; italic: boolean; resolved: boolean };

/** Text further than this many degrees from horizontal (on the displayed page) isn't part of a reading line. */
const MAX_TILT_RADIANS = 0.05;
/** Slack (points) past the page edge before a run counts as off the page. */
const PAGE_EDGE_SLACK = 5;

export type ExtractOptions = {
  /** Called after every page — this is what the progress screen will listen to. */
  onProgress?: (p: ExtractProgress) => void;
  /** Lets a cancelled import stop between pages instead of finishing the book. */
  signal?: AbortSignal;
};

/**
 * Step 3: reads every piece of text in a PDF along with where it sits and
 * what it's set in, and returns it as reconstructed lines plus a profile of
 * how the book is typeset. Structure (chapters, poems) and formatting
 * (marks, headings) are decided later from this — nothing is interpreted here.
 *
 * `bytes` is handed to pdf.js, which may take ownership of the buffer —
 * don't reuse it afterwards (read a fresh copy for any second pass).
 *
 * Expects a PDF that already passed intake (real text layer, readable,
 * within the page cap); throws if pdf.js can't open it anyway.
 */
export async function extractText(bytes: Uint8Array, options: ExtractOptions = {}): Promise<ExtractedText> {
  const started = performance.now();
  const task = openPdf(bytes);

  try {
    const doc = await task.promise;
    const total = doc.numPages;
    const pages: PageText[] = [];

    // A font id means the same font on every page, so each one is resolved
    // once. Resolving needs the page's operator list (that's what loads
    // fonts into pdf.js' shared object store), which is the slow part —
    // caching it means only the first page using a font pays for it.
    const fonts = new Map<string, FontMeta>();

    for (let n = 1; n <= total; n++) {
      if (options.signal?.aborted) throw new DOMException("Extraction cancelled", "AbortError");

      const page = await doc.getPage(n);
      try {
        const pageText = await extractPage(page, n, fonts);
        pages.push(pageText);
        options.onProgress?.({ page: n, total, lines: pageText.lines.length });
      } finally {
        page.cleanup();
      }
    }

    const unresolvedFonts = [...fonts.values()].filter((f) => !f.resolved).length;
    return {
      version: 1,
      pageCount: total,
      pages,
      profile: buildProfile(pages, unresolvedFonts),
      elapsedMs: Math.round(performance.now() - started),
    };
  } finally {
    await task.destroy().catch(() => {});
  }
}

async function extractPage(page: PDFPageProxy, pageNumber: number, fonts: Map<string, FontMeta>): Promise<PageText> {
  const viewport = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();

  // Make sure every font on this page has been looked up.
  const missing = new Set<string>();
  for (const item of content.items) {
    if ("fontName" in item && item.str.length > 0 && !fonts.has(item.fontName)) missing.add(item.fontName);
  }
  if (missing.size > 0) {
    await page.getOperatorList();
    for (const id of missing) fonts.set(id, resolveFont(page, id, content.styles[id]?.fontFamily));
  }

  const runs: RawRun[] = [];
  const skipped = { offAxis: 0, offPage: 0 };

  for (const item of content.items) {
    if (!("str" in item) || item.str.length === 0) continue;

    // PDF space is bottom-up and ignores page rotation / crop box; the
    // viewport transform puts every run where the reader sees it.
    const t = Util.transform(viewport.transform, item.transform);
    const angle = Math.atan2(t[1], t[0]);
    const x = t[4];
    const y = t[5];
    const size = Math.hypot(t[2], t[3]);
    const width = item.width * viewport.scale;

    if (!Number.isFinite(x) || !Number.isFinite(y) || !(size > 0)) continue;

    // Whitespace-only runs are kept (they carry word gaps) but never counted as "sideways".
    if (Math.abs(angle) > MAX_TILT_RADIANS && item.str.trim() !== "") {
      skipped.offAxis++;
      continue;
    }
    if (
      x + width < -PAGE_EDGE_SLACK ||
      x > viewport.width + PAGE_EDGE_SLACK ||
      y < -PAGE_EDGE_SLACK ||
      y > viewport.height + PAGE_EDGE_SLACK
    ) {
      if (item.str.trim() !== "") skipped.offPage++;
      continue;
    }

    const font = fonts.get(item.fontName);
    const style = content.styles[item.fontName];
    runs.push({
      text: item.str,
      x,
      y,
      width,
      size,
      font: font?.name || style?.fontFamily || item.fontName,
      bold: font?.bold ?? false,
      italic: font?.italic ?? false,
      dir: item.dir === "rtl" ? "rtl" : "ltr",
      ascent: style?.ascent,
      descent: style?.descent,
    });
  }

  return {
    page: pageNumber,
    width: Math.round(viewport.width * 10) / 10,
    height: Math.round(viewport.height * 10) / 10,
    lines: buildLines(runs, pageNumber),
    skipped,
  };
}

function resolveFont(page: PDFPageProxy, id: string, fallbackFamily: string | undefined): FontMeta {
  try {
    if (page.commonObjs.has(id)) {
      const raw = page.commonObjs.get(id) as { name?: string } | null;
      if (raw?.name) {
        const parsed = parseFontName(raw.name);
        return { name: parsed.name, bold: parsed.bold, italic: parsed.italic, resolved: true };
      }
    }
  } catch {
    // Font failed to load (corrupt or unsupported): fall through to "unresolved".
  }
  // Without the real name we can't know bold/italic — say so rather than guess.
  return { name: fallbackFamily ?? id, bold: false, italic: false, resolved: false };
}
