/**
 * Output shapes for Step 6 (background extraction). Everything but
 * `image.bytes` is plain JSON, so the job record and the review screen can
 * carry it as-is.
 *
 * Coordinates in `PageBox` are PDF points, top-left origin — the same space
 * as lib/import/extract/types.ts.
 */

export type BackgroundMethod = "embedded-image" | "median-stack" | "flat-color";

/**
 * How far to trust the picture. Plain words, like Confidence in Step 4 —
 * the review screen leans on this to decide how loudly to say "check this".
 *   good = clean enough to use as it is
 *   fair = usable, but look it over (a short book, so a little ghosting is possible)
 *   poor = not worth using automatically; a flat colour is the honest default
 */
export type BackgroundQuality = "good" | "fair" | "poor";

export type PageBox = { left: number; top: number; right: number; bottom: number };

export type BackgroundImage = {
  bytes: Uint8Array;
  mime: "image/png" | "image/jpeg";
  width: number;
  height: number;
};

export type BackgroundResult = {
  version: 1;
  method: BackgroundMethod;
  quality: BackgroundQuality;
  /** What the review screen should pre-select. The person can always choose the other. */
  recommendation: "use-image" | "use-flat-color";
  /** Null when there is no usable picture (a flat colour is all we have). */
  image: BackgroundImage | null;
  /** Sampled from the edge of the page — the always-acceptable landing spot. */
  flatColor: { hex: string; dark: boolean };
  /** Page size the picture was made for, in points. */
  page: { width: number; height: number };
  samples: {
    /** 1-based pages rendered and stacked (empty for an embedded image). */
    pages: number[];
    /** Pages that could have been used. */
    eligible: number;
  };
  /** 0–1: how many sampled pages agreed with the result. Low means the background changes through the book. Null when not measured. */
  consistency: number | null;
  /** Page-number / header marks that sat in the same place on every page and were painted over. */
  cleaned: PageBox[];
  /** Plain-language observations for the review screen. */
  notes: string[];
};

export type BackgroundProgress =
  | { stage: "checking" }
  | { stage: "rendering"; done: number; total: number }
  | { stage: "stacking"; fraction: number }
  | { stage: "cleaning" }
  | { stage: "encoding" };
