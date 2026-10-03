import "server-only";
import { createCanvas as napiCreateCanvas } from "@napi-rs/canvas";
import type { PDFDocumentProxy } from "@/lib/import/pdfjs";
import { rgbaToRaster, type Raster } from "./pixels";

/** Pixels per PDF point. 2 = 144 dpi: crisp on a retina screen without making a 40-page stack heavy. */
export const RENDER_SCALE = 2;

type Canvas2D = {
  canvas: {
    width: number;
    height: number;
    toBuffer: (mime: string, quality?: number) => Buffer;
  };
  context: CanvasRenderingContext2D;
};

/**
 * Canvases come straight from @napi-rs/canvas — the same library pdf.js draws
 * with in Node — rather than from pdf.js's own factory, which isn't part of
 * its public API and has moved between versions. (`doc` is accepted so every
 * caller reads the same; it isn't needed.)
 */
export function createCanvas(_doc: PDFDocumentProxy, width: number, height: number): Canvas2D {
  void _doc;
  const canvas = napiCreateCanvas(width, height);
  return { canvas, context: canvas.getContext("2d") as unknown as CanvasRenderingContext2D } as unknown as Canvas2D;
}

export function destroyCanvas(_doc: PDFDocumentProxy, c: Canvas2D) {
  void _doc;
  // Release the pixel memory right away rather than waiting for a garbage collection.
  c.canvas.width = 0;
  c.canvas.height = 0;
}

/** What the app's own "Cream" preset looks like (lib/manuscript-config.ts) — the stand-in when a page's colour can't be drawn. */
export const STAND_IN_PAGE_COLOR = "#faf5ea";

/** The colour pdf.js paints where it cannot draw something (a fixed debugging colour in its canvas code). */
export const PDFJS_ERROR_RGB = [255, 105, 180] as const;

/**
 * pdf.js can't draw every kind of shading (function-based gradients, which
 * some design tools use for the page colour itself, are the known gap). It
 * swaps in a loud pink instead — which would become the "background".
 *
 * So that ornaments and soft shapes laid over the page blend onto something
 * sensible rather than onto pink, the page's object lookup is wrapped: any
 * shading pdf.js marked as undrawable ("Dummy") is handed back as a flat
 * stand-in colour. This is done where the lookup happens, not by editing the
 * list in advance, because pdf.js asks the worker for a fresh drawing list
 * when it renders and would overwrite an earlier edit. Returns a counter of
 * how many it replaced. If a future pdf.js changes this shape the wrapper
 * simply replaces nothing, and the pink check after rendering still catches it.
 */
function replaceUnsupportedShadings(page: Awaited<ReturnType<PDFDocumentProxy["getPage"]>>, hex: string): { count: () => number } {
  let replaced = 0;
  const heal = (data: unknown) => {
    if (Array.isArray(data) && data[0] === "Dummy") {
      data.length = 0;
      data.push("RadialAxial", "axial", null, [[0, hex], [1, hex]], [0, 0], [1, 0], null, null);
      replaced++;
    }
    return data;
  };
  try {
    const objs = page.objs as unknown as {
      get: (id: string, cb?: ((d: unknown) => void) | null) => unknown;
    };
    const original = objs.get.bind(objs);
    objs.get = (id, cb) => (cb ? original(id, (d) => cb(heal(d))) : heal(original(id)));
  } catch {
    /* see above */
  }
  return { count: () => replaced };
}

export type RenderedPage = { raster: Raster; replacedShadings: number };

/** One page, drawn the way a reader would see it, as raw RGB. */
export async function renderPageRaster(
  doc: PDFDocumentProxy,
  pageNumber: number,
  scale = RENDER_SCALE,
  standInColor = STAND_IN_PAGE_COLOR
): Promise<RenderedPage> {
  const page = await doc.getPage(pageNumber);
  try {
    const healer = replaceUnsupportedShadings(page, standInColor);
    const viewport = page.getViewport({ scale });
    const width = Math.ceil(viewport.width);
    const height = Math.ceil(viewport.height);
    const c = createCanvas(doc, width, height);
    c.context.fillStyle = "#ffffff";
    c.context.fillRect(0, 0, width, height);
    await page.render({
      canvas: c.canvas as unknown as HTMLCanvasElement,
      viewport,
    }).promise;
    const data = c.context.getImageData(0, 0, width, height).data;
    const raster = rgbaToRaster(width, height, data);
    destroyCanvas(doc, c);
    return { raster, replacedShadings: healer.count() };
  } finally {
    page.cleanup();
  }
}
