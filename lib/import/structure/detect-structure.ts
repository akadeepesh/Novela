import type { ExtractedText } from "@/lib/import/extract/types";
import type { ProjectType } from "@/lib/project-config";
import { detectFurniture } from "./furniture";
import { flatten } from "./flatten";
import { detectSeparator } from "./separators";
import { detectHeadings } from "./headings";
import { detectPagePerPiece } from "./pages";
import { segment, type StreamItem } from "./segment";
import { refKey } from "./text-shapes";
import type { Confidence, StructureMethod, StructureResult } from "./types";

export type DetectOptions = {
  projectType: ProjectType;
  /** The person said page 1 is a cover: leave it out of the text entirely. */
  hasFrontCover?: boolean;
  /** Title for a book that couldn't be split (normally the file's name). */
  fallbackTitle?: string;
  /**
   * What to call a section whose heading is just a number, so "5" becomes
   * "Chapter 5" (or "Poem 5"). Callers pass CHAPTER_LABEL_SINGULAR[type];
   * it isn't imported here to keep this engine free of UI configuration.
   */
  bareNumberLabel?: string;
};

const band = (score: number): Confidence => (score >= 0.75 ? "high" : score >= 0.5 ? "medium" : "low");

/**
 * Step 4: works out where one chapter / poem / script ends and the next
 * begins, with a confidence for each piece. Which signals are tried depends
 * on the book type the person chose in Step 2 — a divider marker for poetry,
 * headings for prose and scripts — because the same line means different
 * things in different books.
 *
 * It never guesses silently: when no signal is dependable the whole book
 * comes back as one low-confidence piece and says so, rather than cutting it
 * somewhere plausible-looking and wrong.
 */
export function detectStructure(extracted: ExtractedText, opts: DetectOptions): StructureResult {
  const { projectType } = opts;
  const excluded = new Set<number>(opts.hasFrontCover ? [1] : []);
  const notes: string[] = [];
  if (opts.hasFrontCover) notes.push("Page 1 is the cover, so it was left out of the text.");

  // 1. Page furniture first — page numbers would otherwise masquerade as markers.
  const furn = detectFurniture(extracted.pages, excluded);
  const furnKeys = new Set(furn.furniture.map((f) => refKey(f.ref)));

  // 2. Divider markers (poetry, custom).
  const usesSeparators = projectType === "poetry" || projectType === "custom";
  // Always looked for: for prose and scripts it never splits the book, but it lets
  // us notice when someone picked the wrong kind of book.
  const foundSep = detectSeparator(flatten(extracted.pages, excluded, furnKeys));
  const sepDet = usesSeparators ? foundSep : null;
  const sepKeys = new Set((sepDet?.occurrences ?? []).map(refKey));

  // 3. Headings, judged without the markers in the way.
  const skip = new Set([...furnKeys, ...sepKeys]);
  const flat = flatten(extracted.pages, excluded, skip);
  const headDet = detectHeadings(flat, projectType);

  // 4. Pick a method for this kind of book.
  const sepScore = sepDet?.signal.score ?? 0;
  const headScore = headDet?.signal.score ?? 0;
  let method: StructureMethod = "none";
  if (projectType === "poetry") {
    // Titled poems carry their own boundaries (and names); the marker is then just decoration.
    if (headDet && headScore >= 0.5) method = "heading";
    else if (sepDet) method = "separator";
    else if (headDet) method = "heading";
  } else if (projectType === "custom") {
    if (sepDet && headDet) method = headScore >= sepScore ? "heading" : "separator";
    else if (headDet) method = "heading";
    else if (sepDet) method = "separator";
  } else if (headDet) {
    method = "heading";
  }

  // 4b. Nothing marks the pieces — but a poetry book often gives each poem its own page.
  const totalContentPages = extracted.pages.filter((p) => !excluded.has(p.page)).length;
  const pageDet = method === "none" && usesSeparators ? detectPagePerPiece(flat, totalContentPages) : null;
  if (pageDet) method = "page";

  // 5. Markers that aren't the dividers are still page decoration — but only when we're sure they are markers.
  const dropMarkers = !!sepDet;
  const markerFurniture = dropMarkers
    ? (sepDet?.occurrences ?? []).map((ref) => ({
        ref,
        kind: "separator" as const,
        text: extracted.pages[ref.page - 1]?.lines[ref.index]?.text ?? "",
      }))
    : [];

  // 6. Cut the book.
  const stream: StreamItem[] = [];
  for (const page of extracted.pages) {
    if (excluded.has(page.page)) continue;
    page.lines.forEach((line, index) => {
      const key = refKey({ page: page.page, index });
      if (furnKeys.has(key)) return;
      if (sepKeys.has(key)) stream.push({ kind: "marker", ref: { page: page.page, index }, text: line.text });
      else stream.push({ kind: "line", ref: { page: page.page, index }, text: line.text });
    });
  }

  const baseScore =
    method === "separator" ? sepScore : method === "heading" ? headScore : method === "page" ? (pageDet?.score ?? 0) : 0;
  const pieces = segment({
    stream,
    method,
    baseConfidence: method === "none" ? "low" : band(baseScore),
    fullPages: new Set(pageDet?.fullPages ?? []),
    separator: sepDet?.signal ?? null,
    headings: headDet?.headings,
    headingSignal: headDet?.signal ?? null,
    fallbackTitle: opts.fallbackTitle?.trim() || "Untitled",
    bareNumberLabel: opts.bareNumberLabel ?? "Chapter",
  });

  // 7. Say what happened, in plain words.
  if (method === "separator" && sepDet) {
    const where =
      sepDet.signal.role === "after" ? "at the end of each piece" : sepDet.signal.role === "before" ? "at the start of each piece" : "between pieces";
    notes.push(`Split on a repeating “${sepDet.signal.sample}” marker, ${where} — ${sepDet.signal.count} markers.`);
  } else if (method === "heading" && headDet) {
    notes.push(`Split at ${headDet.signal.count} headings (${headDet.signal.pattern === "styled" ? "set larger or bolder than their text" : headDet.signal.pattern.replace("-", " ")}).`);
    if (headDet.signal.ignoredStyles > 0) notes.push(`${headDet.signal.ignoredStyles} other heading-like style(s) were not used for splitting.`);
    if (sepDet) notes.push(`A repeating “${sepDet.signal.sample}” marker was removed from the text.`);
  } else if (method === "page" && pageDet) {
    notes.push(
      `Nothing between the pieces marks where one ends, but ${pageDet.textPages} of ${pageDet.totalPages} pages each hold a short block of text — so each page is taken as one ${projectType === "poetry" ? "poem" : "piece"}.` +
        (pageDet.fullPages.length ? ` ${pageDet.fullPages.length} page(s) run to the bottom and may continue onto the next.` : "")
    );
  } else {
    notes.push("Couldn’t find a dependable way to split this book, so it’s one long piece. You can split it yourself when you review it.");
    if (!usesSeparators && foundSep && foundSep.signal.score >= 0.75) {
      notes.push(
        `This book has a repeating “${foundSep.signal.sample}” marker (${foundSep.signal.count}×), which usually means a poetry collection — it’s set up as ${projectType === "script-writing" ? "a script" : "a novel"}. Choosing poetry or custom instead may split it properly.`
      );
    }
  }
  if (furn.folio) notes.push(`Removed ${furn.folio.count} page numbers.`);
  for (const rh of furn.runningHeads) notes.push(`Removed a running header “${rh.text}” from ${rh.count} pages.`);
  const spanning = pieces.filter((p) => p.endPage > p.startPage).length;
  // Worth saying for poems (a poem running onto a second page is a thing to check); for chapters it's just normal.
  if (spanning > 0 && pieces.length > 1 && (projectType === "poetry" || method === "separator")) notes.push(`${spanning} piece(s) run across more than one page.`);
  if (headDet && headDet.signal.sequence.jumps.length > 0) {
    notes.push(
      `Numbering isn’t continuous: ${headDet.signal.sequence.jumps.map((j) => `${j.from} → ${j.to}`).join(", ")}.`
    );
  }

  // A page-per-piece reading is an inference from the layout, not a mark in the text: the book as a whole is never better than "medium",
  // while each ordinary page stands as its own settled piece and only the pages that may run on are pointed out.
  const overall: Confidence = method === "none" ? "low" : method === "page" ? "medium" : band(baseScore);
  return {
    version: 1,
    projectType,
    method,
    confidence: overall,
    pieces,
    furniture: [...furn.furniture, ...markerFurniture],
    signals: {
      pagePerPiece: pageDet ? { textPages: pageDet.textPages, fullPages: pageDet.fullPages } : null,
      separator: sepDet?.signal ?? null,
      heading: headDet?.signal ?? null,
      folio: furn.folio,
      runningHeads: furn.runningHeads,
    },
    notes,
  };
}
