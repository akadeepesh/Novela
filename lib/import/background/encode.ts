import "server-only";
import type { PDFDocumentProxy } from "@/lib/import/pdfjs";
import type { BackgroundImage } from "./types";
import { rasterToRgba, rgbaToRaster, type Raster } from "./pixels";
import { createCanvas, destroyCanvas } from "./render";

/** The app stores images under 5MB (lib/blob.ts) — stay clear of it. */
const MAX_BYTES = 4.5 * 1024 * 1024;

function toCanvas(doc: PDFDocumentProxy, r: Raster) {
  const c = createCanvas(doc, r.width, r.height);
  const img = c.context.createImageData(r.width, r.height);
  img.data.set(rasterToRgba(r));
  c.context.putImageData(img, 0, 0);
  return c;
}

/**
 * Lossless PNG first — ornaments and flat colour are what a median stack
 * produces, and PNG keeps them crisp. Only if that's too big does it fall
 * back to a high-quality JPEG, and then to a smaller one.
 */
export function encodeRaster(doc: PDFDocumentProxy, r: Raster): BackgroundImage {
  const c = toCanvas(doc, r);
  try {
    const png = c.canvas.toBuffer("image/png");
    if (png.length <= MAX_BYTES) return { bytes: new Uint8Array(png), mime: "image/png", width: r.width, height: r.height };
    for (const quality of [92, 82, 70]) {
      const jpg = c.canvas.toBuffer("image/jpeg", quality);
      if (jpg.length <= MAX_BYTES) return { bytes: new Uint8Array(jpg), mime: "image/jpeg", width: r.width, height: r.height };
    }
    const jpg = c.canvas.toBuffer("image/jpeg", 60);
    return { bytes: new Uint8Array(jpg), mime: "image/jpeg", width: r.width, height: r.height };
  } finally {
    destroyCanvas(doc, c);
  }
}

/** Photographic / textured pulls: JPEG keeps them small; scaled down only if still over the limit. */
export function encodePhotographic(doc: PDFDocumentProxy, r: Raster): BackgroundImage {
  const c = toCanvas(doc, r);
  try {
    for (const quality of [92, 85, 75]) {
      const jpg = c.canvas.toBuffer("image/jpeg", quality);
      if (jpg.length <= MAX_BYTES) return { bytes: new Uint8Array(jpg), mime: "image/jpeg", width: r.width, height: r.height };
    }
    return { bytes: new Uint8Array(c.canvas.toBuffer("image/jpeg", 60)), mime: "image/jpeg", width: r.width, height: r.height };
  } finally {
    destroyCanvas(doc, c);
  }
}

/** Very large embedded pictures are brought down to a size a phone can draw and the 5MB limit allows. */
export function scaleDownRaster(doc: PDFDocumentProxy, r: Raster, maxEdge = 2600): Raster {
  const longest = Math.max(r.width, r.height);
  if (longest <= maxEdge) return r;
  const k = maxEdge / longest;
  const w = Math.max(1, Math.round(r.width * k));
  const h = Math.max(1, Math.round(r.height * k));
  const src = toCanvas(doc, r);
  const dst = createCanvas(doc, w, h);
  try {
    dst.context.imageSmoothingEnabled = true;
    dst.context.imageSmoothingQuality = "high";
    dst.context.drawImage(src.canvas as unknown as CanvasImageSource, 0, 0, w, h);
    const data = dst.context.getImageData(0, 0, w, h).data;
    return rgbaToRaster(w, h, data);
  } finally {
    destroyCanvas(doc, src);
    destroyCanvas(doc, dst);
  }
}
