import "server-only";
import { OPS, PermissionFlag, openPdf, type PDFDocumentProxy } from "@/lib/import/pdfjs";
import {
  IMPORT_MAX_BYTES,
  IMPORT_MAX_PAGES,
  IMPORT_MIN_CHARS_FOR_TEXT_PAGE,
  rejection,
  type IntakeRejection,
  type IntakeReport,
} from "@/lib/import/config";

export type InspectResult =
  | { ok: true; report: IntakeReport }
  | ({ ok: false } & IntakeRejection);

/**
 * How many text-less pages get an operator-list probe when checking for
 * images. Building an operator list decodes any image on the page, which for
 * a 300dpi scan is the one genuinely slow thing intake does — so past this
 * many candidates we probe an evenly spaced sample and extrapolate (and say
 * so in the report) instead of decoding a whole scanned book just to reject it.
 */
const MAX_IMAGE_PROBES = 24;

// Every operator that paints a raster image. (Vector art — like the
// decorative frames in the book this feature was designed against — never
// hits these, which is exactly why a page full of it counts as "no image".)
const IMAGE_OPS: ReadonlySet<number> = new Set(
  [
    OPS.paintImageXObject,
    OPS.paintInlineImageXObject,
    OPS.paintImageMaskXObject,
    OPS.paintImageXObjectRepeat,
    OPS.paintImageMaskXObjectRepeat,
    OPS.paintInlineImageXObjectGroup,
    OPS.paintSolidColorImageMask,
  ].filter((op): op is number => typeof op === "number")
);

/** `%PDF-` may legally sit anywhere in the first 1024 bytes (some producers prepend junk). */
function hasPdfHeader(bytes: Uint8Array): boolean {
  const head = bytes.subarray(0, Math.min(bytes.length, 1024));
  const needle = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-
  outer: for (let i = 0; i <= head.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (head[i + j] !== needle[j]) continue outer;
    }
    return true;
  }
  return false;
}

async function pageTextLength(doc: PDFDocumentProxy, pageNumber: number): Promise<number> {
  const page = await doc.getPage(pageNumber);
  try {
    const content = await page.getTextContent();
    let chars = 0;
    for (const item of content.items) {
      // Marked-content markers carry no `str`.
      if ("str" in item) chars += item.str.replace(/\s+/g, "").length;
    }
    return chars;
  } finally {
    page.cleanup();
  }
}

async function pagePaintsImage(doc: PDFDocumentProxy, pageNumber: number): Promise<boolean> {
  const page = await doc.getPage(pageNumber);
  try {
    const { fnArray } = await page.getOperatorList();
    for (let i = 0; i < fnArray.length; i++) {
      if (IMAGE_OPS.has(fnArray[i])) return true;
    }
    return false;
  } finally {
    page.cleanup();
  }
}

/** Up to `cap` items from `items`, evenly spaced, always including the first and last. */
function evenSample<T>(items: T[], cap: number): T[] {
  if (items.length <= cap) return items;
  const out: T[] = [];
  for (let i = 0; i < cap; i++) out.push(items[Math.round((i * (items.length - 1)) / (cap - 1))]);
  return out;
}

/**
 * Step 1 of the import pipeline: decides whether a PDF can go any further.
 *
 * Order matters — every check that can be answered without parsing runs
 * before anything that has to parse, and the cheap page-count rejection
 * runs before the (comparatively) expensive per-page text pass.
 *
 * `bytes` may be detached by pdf.js; callers must not reuse it afterwards.
 */
export async function inspectPdf(bytes: Uint8Array): Promise<InspectResult> {
  if (bytes.length === 0) return { ok: false, ...rejection("empty") };
  if (bytes.length > IMPORT_MAX_BYTES) return { ok: false, ...rejection("too-large") };
  if (!hasPdfHeader(bytes)) return { ok: false, ...rejection("not-pdf") };

  const task = openPdf(bytes);

  try {
    let doc: PDFDocumentProxy;
    try {
      doc = await task.promise;
    } catch (err) {
      const name = (err as { name?: string })?.name;
      // Needs a password to open at all. (A file that opens with an empty
      // user password but has an owner password is handled below.)
      if (name === "PasswordException") return { ok: false, ...rejection("password-protected") };
      return { ok: false, ...rejection("unreadable") };
    }

    // ---- encryption -----------------------------------------------------
    // `null` means not encrypted. A Set means encrypted-but-openable; it's
    // only a problem if the author switched copying off — that's a clear
    // "don't extract this" signal and we respect it rather than sidestep it.
    const permissions = await doc.getPermissions();
    const encrypted = permissions !== null;
    if (permissions && !permissions.has(PermissionFlag.COPY)) {
      return { ok: false, ...rejection("copy-restricted") };
    }

    // ---- page cap (before any per-page work) ----------------------------
    const pageCount = doc.numPages;
    if (pageCount < 1) return { ok: false, ...rejection("unreadable") };
    if (pageCount > IMPORT_MAX_PAGES) {
      return { ok: false, ...rejection("too-many-pages", { pageCount }) };
    }

    // ---- text layer, page by page ---------------------------------------
    // Per page rather than "does the file have any text": a half-scanned
    // book would otherwise import its text pages and silently lose the rest.
    let textPages = 0;
    const textless: number[] = [];
    for (let n = 1; n <= pageCount; n++) {
      const chars = await pageTextLength(doc, n);
      if (chars >= IMPORT_MIN_CHARS_FOR_TEXT_PAGE) textPages++;
      else textless.push(n);
    }

    // ---- what are the text-less pages? ----------------------------------
    // Blank pages are normal in a book. Pages that paint an image are either
    // illustrations/a cover (fine, flagged later) or scans (a dealbreaker
    // once they outnumber the readable pages).
    let imageOnlyPages = 0;
    let imageOnlyApproximate = false;

    if (textPages === 0) {
      // Nothing readable at all: one image hit is enough to tell "scan" from "empty/outlined".
      for (const n of evenSample(textless, MAX_IMAGE_PROBES)) {
        if (await pagePaintsImage(doc, n)) {
          return { ok: false, ...rejection("scanned") };
        }
      }
      return { ok: false, ...rejection("no-text") };
    }

    if (textless.length > 0) {
      const probes = evenSample(textless, MAX_IMAGE_PROBES);
      let hits = 0;
      for (const n of probes) {
        if (await pagePaintsImage(doc, n)) hits++;
        // Once image pages outnumber text pages the verdict can't change
        // (hits only grow) — and the remaining probes are the slow ones.
        // Only valid when probing every text-less page, i.e. exact counting.
        if (probes.length === textless.length && hits > textPages) break;
      }
      if (probes.length === textless.length) {
        imageOnlyPages = hits;
      } else {
        imageOnlyPages = Math.round((hits / probes.length) * textless.length);
        imageOnlyApproximate = true;
      }

      if (imageOnlyPages > textPages) {
        return {
          ok: false,
          ...rejection("mostly-scanned", { pageCount, imageOnlyPages, imageOnlyApproximate }),
        };
      }
    }

    return {
      ok: true,
      report: {
        pageCount,
        textPages,
        imageOnlyPages,
        imageOnlyApproximate,
        blankPages: Math.max(0, pageCount - textPages - imageOnlyPages),
        encrypted,
      },
    };
  } catch (err) {
    // Anything pdf.js throws mid-parse (a page with a corrupt content
    // stream, say) means we can't vouch for the file — say so honestly
    // rather than importing part of it.
    console.error("inspectPdf: unexpected failure", err);
    return { ok: false, ...rejection("unreadable") };
  } finally {
    // v6 has no doc.destroy(); the loading task owns cleanup.
    await task.destroy().catch(() => {});
  }
}
