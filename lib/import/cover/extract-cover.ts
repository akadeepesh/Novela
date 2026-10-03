import "server-only";
import { openPdf } from "@/lib/import/pdfjs";
import { encodePhotographic } from "@/lib/import/background/encode";
import { STAND_IN_PAGE_COLOR, renderPageRaster } from "@/lib/import/background/render";
import type { BackgroundImage } from "@/lib/import/background/types";

/** Long edge of the cover picture, in pixels — sharp on a big screen, comfortably under the 5MB image limit as a JPEG. */
const COVER_LONG_EDGE = 1800;

export type CoverResult = {
  version: 1;
  image: BackgroundImage;
  /** Page size the cover was drawn from, in points. */
  page: { width: number; height: number };
  notes: string[];
};

/**
 * Step 7: page 1, drawn exactly as a reader would see it, as the candidate
 * front cover. Only called when the person said page 1 IS the cover — the
 * plan is explicit that a cover is never auto-detected.
 *
 * A cover is meant to be unique, so unlike the background this is a plain
 * render of the page (which also covers the common case of a cover that is
 * one full-page picture with the title on top, text and all).
 */
export async function extractCover(bytes: Uint8Array): Promise<CoverResult> {
  // pdf.js takes ownership of the buffer it is given — work on a copy.
  const task = openPdf(bytes.slice());
  const doc = await task.promise;
  try {
    const first = await doc.getPage(1);
    const [x0, y0, x1, y1] = first.view;
    const width = x1 - x0;
    const height = y1 - y0;
    first.cleanup();

    const scale = Math.min(3, COVER_LONG_EDGE / Math.max(width, height));
    const { raster, replacedShadings } = await renderPageRaster(doc, 1, scale, STAND_IN_PAGE_COLOR);
    const notes: string[] = [];
    if (replacedShadings > 0) {
      notes.push("Part of the cover is painted with a kind of gradient that can’t be read here, so a plain tone stands in for it. Check how the cover looks.");
    }
    return { version: 1, image: encodePhotographic(doc, raster), page: { width, height }, notes };
  } finally {
    // pdf.js v6 has no doc.destroy(); the loading task owns cleanup.
    await task.destroy().catch(() => {});
  }
}
