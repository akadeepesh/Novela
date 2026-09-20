/**
 * The shared intermediate representation every export format renders from.
 * Tiptap/ProseMirror JSON gets converted to this ONCE (see `tiptapToBlocks`
 * below); the PDF/EPUB/DOCX renderers each just walk this plain structure,
 * so a rendering fix or a new format only has to happen in one place.
 */

export type ExportMark = "bold" | "italic";

export type ExportRun = { text: string; marks: ExportMark[] } | { break: true };

export type ExportBlock =
  | { kind: "heading"; level: 1 | 2 | 3; runs: ExportRun[] }
  | { kind: "paragraph"; runs: ExportRun[] }
  | { kind: "blockquote"; runs: ExportRun[] };

export type ExportSection = {
  id: string;
  title: string;
  blocks: ExportBlock[];
};

export type ExportAppendix = {
  /** e.g. "Characters", "World", "Plot", "Notes", "Research" */
  heading: string;
  sections: ExportSection[];
};

export type ExportDocument = {
  title: string;
  authorName?: string;
  genre?: string;
  dedication?: string;
  includeTitlePage: boolean;
  includeTOC: boolean;
  isPoetry: boolean;
  /** Carried over from the manuscript's on-screen page-appearance settings (Part 2). */
  headerText?: string;
  footerText?: string;
  /** Chapters/Poems/Stories, in order — the actual manuscript. */
  manuscript: ExportSection[];
  appendices: ExportAppendix[];
};

// ---- Tiptap JSON -> ExportBlock[] -------------------------------------

type TiptapNode = {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  text?: string;
  marks?: { type: string }[];
};

function flattenInline(nodes: TiptapNode[] | undefined): ExportRun[] {
  if (!nodes) return [];
  const runs: ExportRun[] = [];

  for (const node of nodes) {
    if (node.type === "text" && typeof node.text === "string") {
      const marks = (node.marks ?? [])
        .map((m) => m.type)
        .filter((t): t is ExportMark => t === "bold" || t === "italic");
      runs.push({ text: node.text, marks });
    } else if (node.type === "mention") {
      const label = (node.attrs?.label as string) ?? "";
      runs.push({ text: `@${label}`, marks: ["italic"] });
    } else if (node.type === "hardBreak") {
      runs.push({ break: true });
    }
  }

  return runs;
}

function clampHeadingLevel(level: unknown): 1 | 2 | 3 {
  const n = typeof level === "number" ? level : 1;
  if (n <= 1) return 1;
  if (n >= 3) return 3;
  return 2;
}

/** Converts one chapter/poem/story's Tiptap document JSON into blocks. */
export function tiptapToBlocks(content: unknown): ExportBlock[] {
  const doc = content as TiptapNode | null | undefined;
  if (!doc || !Array.isArray(doc.content)) return [];

  const blocks: ExportBlock[] = [];

  for (const node of doc.content) {
    if (node.type === "heading") {
      blocks.push({
        kind: "heading",
        level: clampHeadingLevel(node.attrs?.level),
        runs: flattenInline(node.content),
      });
    } else if (node.type === "paragraph") {
      const runs = flattenInline(node.content);
      // Skip fully-empty paragraphs (Tiptap keeps one around for cursor
      // placement) rather than emitting a blank line for every one.
      if (runs.length > 0) blocks.push({ kind: "paragraph", runs });
    } else if (node.type === "blockquote" && Array.isArray(node.content)) {
      const runs: ExportRun[] = [];
      node.content.forEach((child, i) => {
        if (i > 0) runs.push({ break: true });
        runs.push(...flattenInline(child.content));
      });
      blocks.push({ kind: "blockquote", runs });
    }
    // Other node types (e.g. future extensions) are simply skipped rather
    // than throwing — an export should degrade gracefully, not fail.
  }

  return blocks;
}

/** Converts a plain-text field (Notes/Research/Character fields) into blocks, one paragraph per line. */
export function plainTextToBlocks(text: string | undefined): ExportBlock[] {
  if (!text) return [];
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => ({ kind: "paragraph" as const, runs: [{ text: line, marks: [] }] }));
}

/** Plain text length of a run list — used for "is this section empty?" checks. */
export function runsText(runs: ExportRun[]): string {
  return runs.map((r) => ("break" in r ? "\n" : r.text)).join("");
}
