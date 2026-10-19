/**
 * The shared intermediate representation every export format renders from.
 * Tiptap/ProseMirror JSON gets converted to this ONCE (see `tiptapToBlocks`
 * below); the PDF/EPUB/DOCX renderers each just walk this plain structure,
 * so a rendering fix or a new format only has to happen in one place.
 */

export type ExportMark = "bold" | "italic" | "underline" | "strike";

const EXPORT_MARKS: readonly string[] = ["bold", "italic", "underline", "strike"];

export type ExportRun = { text: string; marks: ExportMark[] } | { break: true };

export type ExportAlign = "center" | "right" | "justify";

/**
 * Every block carries `runs` (empty for a scene break) so code that only
 * cares about text, like word counts and diffs, can treat them alike.
 */
export type ExportBlock =
  | { kind: "heading"; level: 1 | 2 | 3; runs: ExportRun[]; align?: ExportAlign }
  | { kind: "paragraph"; runs: ExportRun[]; align?: ExportAlign }
  | { kind: "blockquote"; runs: ExportRun[] }
  /** One item of a bulleted/numbered list. `number` is its 1-based position; `depth` 0 is top level. */
  | { kind: "listItem"; ordered: boolean; number: number; depth: number; runs: ExportRun[] }
  /** A break between scenes, shown as a centred "* * *". */
  | { kind: "sceneBreak"; runs: [] };

/** How a scene break is printed in every format. */
export const SCENE_BREAK_TEXT = "*   *   *";

export type ExportSection = {
  id: string;
  title: string;
  /** "Chapter One" / "1" / "Part 3" — undefined means don't show a number at all. Only set on manuscript sections, never appendices. */
  numberLabel?: string;
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
  /** PDF-only page size (Part 4.2 export defaults) — see lib/export-config.ts. */
  trimSize: string;
  /** Back-cover blurb (Part 4.2), optional — rendered as its own page after the manuscript/appendices, never shown as an empty box when absent. */
  backCoverBlurb?: string;
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
        .filter((t): t is ExportMark => EXPORT_MARKS.includes(t));
      runs.push({ text: node.text, marks });
    } else if (node.type === "mention") {
      // @-mentions are a writing aid. On the page, a reader should just see
      // the name, as if it had been typed.
      const label = (node.attrs?.label as string) ?? "";
      runs.push({ text: label, marks: [] });
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

function alignOf(node: TiptapNode): ExportAlign | undefined {
  const a = node.attrs?.textAlign;
  return a === "center" || a === "right" || a === "justify" ? a : undefined;
}

/** Text of every textblock inside `node`, joined with line breaks. */
function textblockRuns(node: TiptapNode): ExportRun[] {
  if (!Array.isArray(node.content)) return [];
  if (node.content.some((c) => c.type === "text" || c.type === "mention" || c.type === "hardBreak")) {
    return flattenInline(node.content);
  }
  const runs: ExportRun[] = [];
  node.content.forEach((child, i) => {
    const childRuns = textblockRuns(child);
    if (childRuns.length === 0) return;
    if (i > 0 && runs.length > 0) runs.push({ break: true });
    runs.push(...childRuns);
  });
  return runs;
}

function pushList(node: TiptapNode, ordered: boolean, depth: number, blocks: ExportBlock[]) {
  const start = typeof node.attrs?.start === "number" ? node.attrs.start : 1;
  (node.content ?? []).forEach((item, i) => {
    // A list item holds paragraphs, and possibly a nested list.
    const runs: ExportRun[] = [];
    const nested: TiptapNode[] = [];
    for (const child of item.content ?? []) {
      if (child.type === "bulletList" || child.type === "orderedList") nested.push(child);
      else {
        const childRuns = textblockRuns(child);
        if (childRuns.length === 0) continue;
        if (runs.length > 0) runs.push({ break: true });
        runs.push(...childRuns);
      }
    }
    blocks.push({ kind: "listItem", ordered, number: start + i, depth, runs });
    for (const list of nested) pushList(list, list.type === "orderedList", depth + 1, blocks);
  });
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
        align: alignOf(node),
      });
    } else if (node.type === "paragraph") {
      const runs = flattenInline(node.content);
      // Skip fully-empty paragraphs (Tiptap keeps one around for cursor
      // placement) rather than emitting a blank line for every one.
      if (runs.length > 0) blocks.push({ kind: "paragraph", runs, align: alignOf(node) });
    } else if (node.type === "blockquote" && Array.isArray(node.content)) {
      blocks.push({ kind: "blockquote", runs: textblockRuns(node) });
    } else if (node.type === "bulletList" || node.type === "orderedList") {
      pushList(node, node.type === "orderedList", 0, blocks);
    } else if (node.type === "horizontalRule") {
      blocks.push({ kind: "sceneBreak", runs: [] });
    } else if (node.type === "codeBlock") {
      // Not a manuscript feature, but never drop text someone typed.
      const runs = textblockRuns(node);
      if (runs.length > 0) blocks.push({ kind: "paragraph", runs });
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
