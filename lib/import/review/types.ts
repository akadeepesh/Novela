/**
 * Shared (client + server) shapes for the review screen — the person's
 * working copy of the import. Everything here is plain JSON: it is saved to
 * the job record as they work and read again at commit.
 */
import type { TiptapDoc } from "@/lib/import/format/types";
import type { Confidence } from "@/lib/import/structure/types";
import type { BackgroundMethod, BackgroundQuality } from "@/lib/import/background/types";
import type { BackgroundId } from "@/lib/manuscript-config";

export type TitleSource = "heading" | "first-line" | "fallback" | "edited";

export type ReviewPiece = {
  id: string;
  title: string;
  titleSource: TitleSource;
  startPage: number;
  endPage: number;
  layout: "verse" | "prose";
  /** How sure Step 4 was about where this piece starts and ends. */
  confidence: Confidence;
  /** Plain-words reasons to look at this piece. Empty when nothing needs a second look. */
  flags: string[];
  /** The person has looked at it (or changed it themselves). */
  checked: boolean;
  doc: TiptapDoc;
  wordCount: number;
};

export type PresetId = Exclude<BackgroundId, "custom">;
export type BackgroundChoice = { kind: "image" } | { kind: "preset"; id: PresetId };

export type ReviewState = {
  version: 1;
  bookTitle: string;
  pieces: ReviewPiece[];
  background: BackgroundChoice;
  /** Use the front-cover picture lifted from page 1 (only meaningful when there is one). */
  useCover: boolean;
  /** Counter for ids of pieces created by splitting. */
  seq: number;
};

/** What the page-design panel needs to know about the lifted background. */
export type BackgroundInfo = {
  method: BackgroundMethod;
  quality: BackgroundQuality;
  recommendation: "use-image" | "use-flat-color";
  flatColor: { hex: string; dark: boolean };
  notes: string[];
  hasImage: boolean;
  /** Touch-ups have been saved over the original picture. */
  touchedUp: boolean;
};

export const needsLook = (p: ReviewPiece) => !p.checked && p.flags.length > 0;
