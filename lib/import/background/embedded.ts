import "server-only";
import { OPS, Util, type PDFDocumentProxy } from "@/lib/import/pdfjs";
import { rgbaToRaster, type Raster } from "./pixels";
import { createCanvas, destroyCanvas } from "./render";

/** An image counts as "the background" when it covers at least this much of the page both ways. */
const COVERS = 0.9;
/** …and when it is the same picture on at least this share of the pages looked at. */
const SHARED_BY = 0.6;
const PROBE_PAGES = 8;

type Matrix = number[];
type ImageHit = { id: string; common: boolean };

type PdfObj = {
  width: number;
  height: number;
  kind?: number;
  data?: Uint8Array | Uint8ClampedArray;
  bitmap?: ImageBitmap;
};

function fnv(data: ArrayLike<number>, width: number, height: number): string {
  let h = 2166136261;
  const step = Math.max(1, Math.floor(data.length / 512));
  for (let i = 0; i < data.length; i += step) {
    h ^= data[i];
    h = Math.imul(h, 16777619);
  }
  return `${width}x${height}:${(h >>> 0).toString(16)}`;
}

/** Every image painted across (nearly) the whole page, in drawing order. */
async function fullPageImages(page: Awaited<ReturnType<PDFDocumentProxy["getPage"]>>): Promise<ImageHit[]> {
  const [vx0, vy0, vx1, vy1] = page.view;
  const pageW = vx1 - vx0;
  const pageH = vy1 - vy0;
  const ops = await page.getOperatorList();
  const hits: ImageHit[] = [];

  let ctm: Matrix = [1, 0, 0, 1, 0, 0];
  const stack: Matrix[] = [];

  ops.fnArray.forEach((fn, i) => {
    const args = ops.argsArray[i] as unknown[] | null;
    switch (fn) {
      case OPS.save:
        stack.push(ctm);
        break;
      case OPS.restore:
        ctm = stack.pop() ?? ctm;
        break;
      case OPS.transform:
        ctm = Util.transform(ctm, args as Matrix);
        break;
      case OPS.paintFormXObjectBegin:
        stack.push(ctm);
        if (args && Array.isArray(args[0])) ctm = Util.transform(ctm, args[0] as Matrix);
        break;
      case OPS.paintFormXObjectEnd:
        ctm = stack.pop() ?? ctm;
        break;
      case OPS.paintImageXObject:
      case OPS.paintImageXObjectRepeat: {
        // The image is the unit square under the current matrix.
        const [a, b, c, d, e, f] = ctm;
        const xs = [e, e + a, e + c, e + a + c];
        const ys = [f, f + b, f + d, f + b + d];
        const w = Math.max(...xs) - Math.min(...xs);
        const h = Math.max(...ys) - Math.min(...ys);
        if (w >= pageW * COVERS && h >= pageH * COVERS) {
          const id = String((args as unknown[])[0]);
          hits.push({ id, common: id.startsWith("g_") });
        }
        break;
      }
      default:
        break;
    }
  });
  return hits;
}

function objectOf(page: Awaited<ReturnType<PDFDocumentProxy["getPage"]>>, hit: ImageHit): Promise<PdfObj | null> {
  return new Promise((resolve) => {
    const store = hit.common ? page.commonObjs : page.objs;
    const timer = setTimeout(() => resolve(null), 8000);
    try {
      store.get(hit.id, (obj: PdfObj | null) => {
        clearTimeout(timer);
        resolve(obj ?? null);
      });
    } catch {
      clearTimeout(timer);
      resolve(null);
    }
  });
}

function toRaster(doc: PDFDocumentProxy, obj: PdfObj): Raster | null {
  const { width, height } = obj;
  if (!width || !height) return null;

  if (obj.bitmap) {
    const c = createCanvas(doc, width, height);
    try {
      c.context.drawImage(obj.bitmap as unknown as CanvasImageSource, 0, 0);
      return rgbaToRaster(width, height, c.context.getImageData(0, 0, width, height).data);
    } finally {
      destroyCanvas(doc, c);
    }
  }
  if (!obj.data) return null;

  const px = width * height;
  const rgba = new Uint8ClampedArray(px * 4);
  const d = obj.data;
  if (obj.kind === 3 || d.length === px * 4) {
    rgba.set(d.subarray(0, px * 4));
  } else if (obj.kind === 2 || d.length === px * 3) {
    for (let i = 0, j = 0; i < px; i++, j += 3) {
      rgba[i * 4] = d[j];
      rgba[i * 4 + 1] = d[j + 1];
      rgba[i * 4 + 2] = d[j + 2];
      rgba[i * 4 + 3] = 255;
    }
  } else if (obj.kind === 1) {
    const rowBytes = Math.ceil(width / 8);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const on = (d[y * rowBytes + (x >> 3)] >> (7 - (x & 7))) & 1;
        const k = (y * width + x) * 4;
        rgba[k] = rgba[k + 1] = rgba[k + 2] = on ? 255 : 0;
        rgba[k + 3] = 255;
      }
    }
  } else {
    return null;
  }
  return rgbaToRaster(width, height, rgba);
}

export type EmbeddedResult =
  | { found: false }
  | { found: true; raster: Raster; pagesWith: number; probed: number };

/**
 * Strategy A: is there a real picture, the same on (nearly) every page, laid
 * across the whole page? Then it can be pulled out exactly as it was made.
 * A scan has a different full-page image on every page, so it never matches;
 * a cover that appears once doesn't reach the share needed either.
 */
export async function findEmbeddedBackground(doc: PDFDocumentProxy, eligiblePages: number[]): Promise<EmbeddedResult> {
  const probes: number[] = [];
  const count = Math.min(PROBE_PAGES, eligiblePages.length);
  for (let k = 0; k < count; k++) {
    probes.push(eligiblePages[count === 1 ? 0 : Math.round((k * (eligiblePages.length - 1)) / (count - 1))]);
  }

  const seen = new Map<string, { pages: Set<number>; obj: PdfObj }>();
  for (const pageNumber of probes) {
    const page = await doc.getPage(pageNumber);
    try {
      const hits = await fullPageImages(page);
      const signatures = new Set<string>();
      for (const hit of hits) {
        const obj = await objectOf(page, hit);
        if (!obj) continue;
        const pixels = obj.data ?? new Uint8Array(0);
        const sig = fnv(pixels, obj.width, obj.height);
        if (signatures.has(sig)) continue;
        signatures.add(sig);
        const entry = seen.get(sig);
        if (entry) entry.pages.add(pageNumber);
        else seen.set(sig, { pages: new Set([pageNumber]), obj: { ...obj } });
      }
    } finally {
      page.cleanup();
    }
  }

  const needed = Math.max(1, Math.ceil(probes.length * SHARED_BY));
  const best = [...seen.values()].sort((a, b) => b.pages.size - a.pages.size)[0];
  if (!best || best.pages.size < needed) return { found: false };
  const raster = toRaster(doc, best.obj);
  if (!raster) return { found: false };
  return { found: true, raster, pagesWith: best.pages.size, probed: probes.length };
}
