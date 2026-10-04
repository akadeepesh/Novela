import type { FormattedBook } from "@/lib/import/format/types";
import type { BackgroundInfo, BackgroundChoice, ReviewPiece, ReviewState } from "./types";

/** "Shayari_Book_Full_v2_review.pdf" → "Shayari Book": underscores to spaces, trailing version/status words dropped. */
export function bookTitleFromFileName(fileName: string): string {
  const base = fileName.replace(/\.pdf$/i, "").replace(/[_]+/g, " ").replace(/\s+/g, " ").trim();
  const words = base.split(" ");
  const noise = /^(v\d+(\.\d+)*|final|full|review|draft|copy|new|latest|export|version|edited?|\(\d+\))$/i;
  while (words.length > 1 && noise.test(words[words.length - 1])) words.pop();
  return words.join(" ").trim() || "My book";
}

/** Which background to pre-select: the lifted design when it's trustworthy, otherwise the plain preset closest to the page's own tone. */
export function initialBackground(info: BackgroundInfo | null): BackgroundChoice {
  if (info?.hasImage && info.recommendation === "use-image") return { kind: "image" };
  return { kind: "preset", id: info?.flatColor.dark ? "midnight" : "cream" };
}

export function buildInitialReview(
  book: FormattedBook,
  opts: { fileName: string; background: BackgroundInfo | null; hasCover: boolean }
): ReviewState {
  const pieces: ReviewPiece[] = book.pieces.map((p) => ({
    id: `p${p.index}`,
    title: p.title,
    titleSource: p.titleSource,
    startPage: p.startPage,
    endPage: p.endPage,
    layout: p.layout,
    confidence: p.confidence,
    flags: p.confidence === "high" ? [] : p.reasons.length ? p.reasons : ["Worth a second look at where this begins and ends."],
    checked: false,
    doc: p.doc,
    wordCount: p.wordCount,
  }));
  return {
    version: 1,
    bookTitle: bookTitleFromFileName(opts.fileName),
    pieces,
    background: initialBackground(opts.background),
    useCover: opts.hasCover,
    seq: 0,
  };
}
