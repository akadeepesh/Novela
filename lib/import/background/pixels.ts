/**
 * Pure pixel maths for background extraction — no pdf.js, no canvas — so the
 * algorithm can be tested on its own and the render step stays a thin shell.
 * Rasters are tightly packed 8-bit RGB (3 bytes per pixel, no alpha).
 */
import type { PageBox } from "./types";

export type Raster = { width: number; height: number; rgb: Uint8Array };

export const yieldToEventLoop = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** RGBA (as canvases hand it out) → RGB, flattening any transparency onto white. */
export function rgbaToRaster(width: number, height: number, rgba: ArrayLike<number>): Raster {
  const rgb = new Uint8Array(width * height * 3);
  for (let i = 0, j = 0; i < width * height * 4; i += 4, j += 3) {
    const a = rgba[i + 3] / 255;
    rgb[j] = Math.round(rgba[i] * a + 255 * (1 - a));
    rgb[j + 1] = Math.round(rgba[i + 1] * a + 255 * (1 - a));
    rgb[j + 2] = Math.round(rgba[i + 2] * a + 255 * (1 - a));
  }
  return { width, height, rgb };
}

export function rasterToRgba(r: Raster): Uint8ClampedArray {
  const out = new Uint8ClampedArray(r.width * r.height * 4);
  for (let i = 0, j = 0; j < r.rgb.length; i += 4, j += 3) {
    out[i] = r.rgb[j];
    out[i + 1] = r.rgb[j + 1];
    out[i + 2] = r.rgb[j + 2];
    out[i + 3] = 255;
  }
  return out;
}

/**
 * Per-pixel, per-channel median across same-sized rasters.
 *
 * What the pages share survives; what varies from page to page — the writing —
 * is outvoted. Most pixels are identical on every page, so those take a fast
 * path; only pixels where pages disagree are sorted. Runs in bands, yielding
 * between them so the server stays responsive and progress can be reported.
 */
export async function medianStack(
  rasters: Raster[],
  onProgress?: (fraction: number) => void
): Promise<Raster> {
  if (rasters.length === 0) throw new Error("medianStack needs at least one raster");
  const { width, height } = rasters[0];
  for (const r of rasters) {
    if (r.width !== width || r.height !== height) throw new Error("medianStack needs rasters of one size");
  }
  const n = rasters.length;
  const out = new Uint8Array(width * height * 3);
  const scratch = new Uint8Array(n);
  const mid = (n - 1) >> 1;
  const BAND_ROWS = 48;

  for (let y0 = 0; y0 < height; y0 += BAND_ROWS) {
    const from = y0 * width * 3;
    const to = Math.min(height, y0 + BAND_ROWS) * width * 3;
    for (let k = from; k < to; k++) {
      const first = rasters[0].rgb[k];
      let same = true;
      for (let s = 1; s < n; s++) {
        if (rasters[s].rgb[k] !== first) {
          same = false;
          break;
        }
      }
      if (same) {
        out[k] = first;
        continue;
      }
      // Insertion sort — n is at most a few dozen.
      for (let s = 0; s < n; s++) {
        const v = rasters[s].rgb[k];
        let p = s - 1;
        while (p >= 0 && scratch[p] > v) {
          scratch[p + 1] = scratch[p];
          p--;
        }
        scratch[p + 1] = v;
      }
      out[k] = scratch[mid];
    }
    onProgress?.(Math.min(1, (y0 + BAND_ROWS) / height));
    await yieldToEventLoop();
  }
  return { width, height, rgb: out };
}

/** How much of `sample` sits within `tolerance` (per channel) of `reference`: 1 = identical. */
export function similarity(sample: Raster, reference: Raster, tolerance = 14): number {
  let close = 0;
  const px = sample.width * sample.height;
  for (let i = 0, k = 0; i < px; i++, k += 3) {
    if (
      Math.abs(sample.rgb[k] - reference.rgb[k]) <= tolerance &&
      Math.abs(sample.rgb[k + 1] - reference.rgb[k + 1]) <= tolerance &&
      Math.abs(sample.rgb[k + 2] - reference.rgb[k + 2]) <= tolerance
    ) {
      close++;
    }
  }
  return close / px;
}

/**
 * The share of sampled pages that look like the result (≥ 80% of their pixels
 * match). Writing covers a small part of a page, so a page on the same
 * template scores high; a page on a different background scores low.
 */
export function consistencyOf(samples: Raster[], result: Raster): number {
  if (samples.length === 0) return 0;
  const agreeing = samples.filter((s) => similarity(s, result) >= 0.8).length;
  return agreeing / samples.length;
}

const toHex = (n: number) => n.toString(16).padStart(2, "0");

/** The page's own colour, read from a thin band all round the edge — what a flat-colour fallback should be. */
export function edgeColor(r: Raster): { hex: string; dark: boolean } {
  const band = Math.max(2, Math.round(Math.min(r.width, r.height) * 0.015));
  const reds: number[] = [];
  const greens: number[] = [];
  const blues: number[] = [];
  const take = (x: number, y: number) => {
    const k = (y * r.width + x) * 3;
    reds.push(r.rgb[k]);
    greens.push(r.rgb[k + 1]);
    blues.push(r.rgb[k + 2]);
  };
  for (let y = 0; y < r.height; y += 3) {
    for (let x = 0; x < band; x++) {
      take(x, y);
      take(r.width - 1 - x, y);
    }
  }
  for (let x = 0; x < r.width; x += 3) {
    for (let y = 0; y < band; y++) {
      take(x, y);
      take(x, r.height - 1 - y);
    }
  }
  const med = (a: number[]) => a.sort((p, q) => p - q)[a.length >> 1];
  const [R, G, B] = [med(reds), med(greens), med(blues)];
  const luminance = (0.2126 * R + 0.7152 * G + 0.0722 * B) / 255;
  return { hex: `#${toHex(R)}${toHex(G)}${toHex(B)}`, dark: luminance < 0.45 };
}

export type PxBox = { x0: number; y0: number; x1: number; y1: number };

export function clampBox(b: PxBox, width: number, height: number): PxBox {
  return {
    x0: Math.max(0, Math.floor(b.x0)),
    y0: Math.max(0, Math.floor(b.y0)),
    x1: Math.min(width, Math.ceil(b.x1)),
    y1: Math.min(height, Math.ceil(b.y1)),
  };
}

/** What each column of the box would look like if the mark were never there: a straight blend between the pixels just above and just below. */
function expectedColumn(r: Raster, x: number, box: PxBox, out: Float32Array) {
  const sampleRow = (y: number) => {
    const yy = Math.min(r.height - 1, Math.max(0, y));
    const k = (yy * r.width + x) * 3;
    return [r.rgb[k], r.rgb[k + 1], r.rgb[k + 2]];
  };
  const top = sampleRow(box.y0 - 2);
  const bottom = sampleRow(box.y1 + 1);
  const h = box.y1 - box.y0;
  for (let y = 0; y < h; y++) {
    const t = h <= 1 ? 0 : y / (h - 1);
    for (let c = 0; c < 3; c++) out[y * 3 + c] = top[c] + (bottom[c] - top[c]) * t;
  }
}

/** The share of a box's pixels that differ clearly from what the background around it would be — i.e. how much of a mark is left in it. */
export function inkShare(r: Raster, rawBox: PxBox, threshold = 18): number {
  const box = clampBox(rawBox, r.width, r.height);
  const h = box.y1 - box.y0;
  const w = box.x1 - box.x0;
  if (h <= 0 || w <= 0) return 0;
  const col = new Float32Array(h * 3);
  let marked = 0;
  for (let x = box.x0; x < box.x1; x++) {
    expectedColumn(r, x, box, col);
    for (let y = 0; y < h; y++) {
      const k = ((box.y0 + y) * r.width + x) * 3;
      const d = Math.max(
        Math.abs(r.rgb[k] - col[y * 3]),
        Math.abs(r.rgb[k + 1] - col[y * 3 + 1]),
        Math.abs(r.rgb[k + 2] - col[y * 3 + 2])
      );
      if (d > threshold) marked++;
    }
  }
  return marked / (w * h);
}

/**
 * Paints a box over with the background that surrounds it. This is the one
 * routine behind both the automatic page-number clean-up and the review
 * screen's touch-up tool, so the two always behave alike.
 */
export function paintOver(r: Raster, rawBox: PxBox): void {
  const box = clampBox(rawBox, r.width, r.height);
  const h = box.y1 - box.y0;
  if (h <= 0 || box.x1 <= box.x0) return;
  const col = new Float32Array(h * 3);
  for (let x = box.x0; x < box.x1; x++) {
    expectedColumn(r, x, box, col);
    for (let y = 0; y < h; y++) {
      const k = ((box.y0 + y) * r.width + x) * 3;
      r.rgb[k] = Math.round(col[y * 3]);
      r.rgb[k + 1] = Math.round(col[y * 3 + 1]);
      r.rgb[k + 2] = Math.round(col[y * 3 + 2]);
    }
  }
}

export const pointsToPx = (b: PageBox, scale: number): PxBox => ({
  x0: b.left * scale,
  y0: b.top * scale,
  x1: b.right * scale,
  y1: b.bottom * scale,
});
