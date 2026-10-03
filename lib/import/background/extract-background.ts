import "server-only";
import { openPdf } from "@/lib/import/pdfjs";
import { findEmbeddedBackground } from "./embedded";
import { encodePhotographic, encodeRaster, scaleDownRaster } from "./encode";
import {
  consistencyOf,
  edgeColor,
  inkShare,
  medianStack,
  paintOver,
  pointsToPx,
  type Raster,
} from "./pixels";
import { PDFJS_ERROR_RGB, RENDER_SCALE, STAND_IN_PAGE_COLOR, renderPageRaster } from "./render";
import {
  GOOD_SAMPLES,
  MAX_SAMPLES,
  MIN_CONSISTENCY,
  MIN_USEFUL_SAMPLES,
  eligiblePages,
  pickSamplePages,
  qualityFromSamples,
} from "./sampling";
import type { BackgroundProgress, BackgroundResult, PageBox } from "./types";

export type ExtractBackgroundOptions = {
  /** From Step 2: the first page is a cover, not an interior page, and is left out of sampling. */
  hasFrontCover: boolean;
  /** Marks that sit in the same place on every page (Step 4 finds these); painted over if any ink survives the stacking. */
  recurringMarks?: PageBox[];
  /** For testing and the review screen's "try again": skip the embedded-image check. */
  skipEmbedded?: boolean;
  maxSamples?: number;
  scale?: number;
  /** Page colour to use where the PDF's own can't be drawn. Defaults to the app's "Cream" preset. */
  standInColor?: string;
  onProgress?: (p: BackgroundProgress) => void;
};

/** Share of pixels that are exactly pdf.js's "couldn't draw this" pink. */
function errorPinkShare(r: Raster): number {
  let n = 0;
  const px = r.width * r.height;
  for (let i = 0; i < px; i += 5) {
    const k = i * 3;
    if (r.rgb[k] === PDFJS_ERROR_RGB[0] && r.rgb[k + 1] === PDFJS_ERROR_RGB[1] && r.rgb[k + 2] === PDFJS_ERROR_RGB[2]) n++;
  }
  return n / Math.ceil(px / 5);
}

/** A raster whose every sampled pixel is (nearly) the edge colour has no decoration to extract. */
function isPlain(r: Raster, edgeHex: string): boolean {
  const target = [1, 3, 5].map((i) => parseInt(edgeHex.slice(i, i + 2), 16));
  let off = 0;
  let total = 0;
  for (let i = 0; i < r.width * r.height; i += 7) {
    total++;
    const k = i * 3;
    if (
      Math.abs(r.rgb[k] - target[0]) > 6 ||
      Math.abs(r.rgb[k + 1] - target[1]) > 6 ||
      Math.abs(r.rgb[k + 2] - target[2]) > 6
    ) {
      off++;
    }
  }
  return off / total < 0.002;
}

/**
 * Step 6: the page background of an imported book, as an image.
 *
 *   A. a picture laid across every page → pulled out as it is (exact);
 *   B. otherwise the pages are drawn and stacked — what's the same on every
 *      page (frame, flowers, colour) survives, what changes (the writing)
 *      is outvoted — with the plan's sample-size rules as real logic;
 *   and a flat colour from the page edge is always returned alongside, as the
 *   honest fallback when a picture can't be trusted.
 */
export async function extractBackground(bytes: Uint8Array, opts: ExtractBackgroundOptions): Promise<BackgroundResult> {
  const scale = opts.scale ?? RENDER_SCALE;
  // pdf.js takes ownership of the buffer it is given (it is transferred to the worker), so hand it a copy —
  // the caller's bytes stay usable for the other pipeline stages.
  const task = openPdf(bytes.slice());
  const doc = await task.promise;
  const notes: string[] = [];
  const progress = opts.onProgress ?? (() => {});

  try {
    progress({ stage: "checking" });
    const sizes: { width: number; height: number }[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const [x0, y0, x1, y1] = page.view;
      sizes.push({ width: x1 - x0, height: y1 - y0 });
      page.cleanup();
    }
    let eligible = eligiblePages(sizes, opts.hasFrontCover);
    if (eligible.length === 0) eligible = sizes.map((_, i) => i + 1);
    const pageSize = sizes[eligible[0] - 1];
    const base = { version: 1 as const, page: pageSize };

    // ── Strategy A: a picture that is already in the file ──────────────────
    if (!opts.skipEmbedded) {
      const embedded = await findEmbeddedBackground(doc, eligible);
      if (embedded.found) {
        progress({ stage: "encoding" });
        const raster = scaleDownRaster(doc, embedded.raster);
        const image = encodePhotographic(doc, raster);
        notes.push(
          `The book has a picture laid across its pages (the same one on ${embedded.pagesWith} of the ${embedded.probed} pages checked), so it was taken out exactly as it was made.`
        );
        return {
          ...base,
          method: "embedded-image",
          quality: "good",
          recommendation: "use-image",
          image,
          flatColor: edgeColor(raster),
          samples: { pages: [], eligible: eligible.length },
          consistency: null,
          cleaned: [],
          notes,
        };
      }
    }

    // ── Strategy B: stack the pages ────────────────────────────────────────
    const pages = pickSamplePages(eligible, opts.maxSamples ?? MAX_SAMPLES);
    const rasters: Raster[] = [];
    let replacedShadings = 0;
    for (let i = 0; i < pages.length; i++) {
      progress({ stage: "rendering", done: i, total: pages.length });
      const rendered = await renderPageRaster(doc, pages[i], scale, opts.standInColor ?? STAND_IN_PAGE_COLOR);
      replacedShadings += rendered.replacedShadings;
      rasters.push(rendered.raster);
    }
    progress({ stage: "rendering", done: pages.length, total: pages.length });

    const stacked = await medianStack(rasters, (fraction) => progress({ stage: "stacking", fraction }));
    const consistency = rasters.length >= 3 ? consistencyOf(rasters, stacked) : null;

    progress({ stage: "cleaning" });
    const cleaned: PageBox[] = [];
    for (const mark of opts.recurringMarks ?? []) {
      const box = pointsToPx(mark, scale);
      if (inkShare(stacked, box) > 0.01) {
        paintOver(stacked, box);
        cleaned.push(mark);
      }
    }
    if (cleaned.length) {
      notes.push(
        `${cleaned.length === 1 ? "A mark" : `${cleaned.length} marks`} that sat in the same place on every page (the page numbers) couldn’t be averaged away, so ${cleaned.length === 1 ? "it was" : "they were"} painted over with the background around ${cleaned.length === 1 ? "it" : "them"}.`
      );
    }

    const flatColor = edgeColor(stacked);
    let quality = qualityFromSamples(pages.length, consistency);

    // The page colour was painted with something pdf.js can't draw: say so, and say what stood in.
    if (replacedShadings > 0) {
      notes.push(
        `This book paints its page colour with a kind of gradient that can’t be read here, so the app’s Cream tone (${opts.standInColor ?? STAND_IN_PAGE_COLOR}) stands in for it. The frame and ornaments are exact; if the colour isn’t quite right, you can change it.`
      );
    }
    // Safety net: pink still showing means something else couldn't be drawn and wasn't caught above.
    if (errorPinkShare(stacked) > 0.005) {
      quality = "poor";
      notes.push("Part of the page couldn’t be drawn by the reader used here, so the picture isn’t trustworthy. A plain colour is recommended.");
    }

    // A book with no decoration at all: nothing to extract, and saying so is the right answer.
    if (isPlain(stacked, flatColor.hex)) {
      notes.push("The pages are a plain colour with no decoration, so there’s no picture to extract — a flat background matches them exactly.");
      return {
        ...base,
        method: "flat-color",
        quality: "good",
        recommendation: "use-flat-color",
        image: null,
        flatColor,
        samples: { pages, eligible: eligible.length },
        consistency,
        cleaned: [],
        notes,
      };
    }

    if (pages.length < MIN_USEFUL_SAMPLES) {
      notes.push(
        `Only ${pages.length} page${pages.length === 1 ? "" : "s"} could be sampled, and a clean result needs about ${GOOD_SAMPLES}. The picture will probably show faint traces of the writing, so a plain colour background is the safer choice.`
      );
    } else if (pages.length < GOOD_SAMPLES) {
      notes.push(`${pages.length} pages were sampled (about ${GOOD_SAMPLES} gives the cleanest result), so check the picture for faint traces of the writing.`);
    }
    if (consistency !== null && consistency < MIN_CONSISTENCY) {
      notes.push("The background changes through the book — it isn’t one design on every page — so a single picture can’t represent it. A plain colour is recommended.");
    }

    progress({ stage: "encoding" });
    const image = encodeRaster(doc, stacked);
    return {
      ...base,
      method: "median-stack",
      quality,
      recommendation: quality === "poor" ? "use-flat-color" : "use-image",
      image,
      flatColor,
      samples: { pages, eligible: eligible.length },
      consistency,
      cleaned,
      notes,
    };
  } finally {
    // pdf.js v6 has no doc.destroy(); the loading task owns cleanup (same as inspect-pdf.ts / extract-text.ts).
    await task.destroy().catch(() => {});
  }
}
