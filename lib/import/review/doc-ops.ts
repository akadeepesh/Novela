/**
 * Pure operations on a piece's Tiptap document: the arithmetic behind merge
 * and split, plus a flattened view for previews. Works on exactly the shapes
 * Step 5 produces (paragraphs and headings holding text and hard breaks).
 */
import type { TiptapDoc, TiptapNode } from "@/lib/import/format/types";
import { countWords, emptyDoc } from "@/lib/import/format/tiptap";

export { countWords, emptyDoc };

const isBlank = (n: TiptapNode) => n.type === "paragraph" && !(n.content?.length ?? 0);

/** One block's inline content, cut into its lines (a hard break ends a line). */
export function blockLines(block: TiptapNode): TiptapNode[][] {
  const lines: TiptapNode[][] = [[]];
  for (const n of block.content ?? []) {
    if (n.type === "hardBreak") lines.push([]);
    else lines[lines.length - 1].push(n);
  }
  return lines;
}

const joinLines = (lines: TiptapNode[][]): TiptapNode[] =>
  lines.flatMap((l, i) => (i === 0 ? l : [{ type: "hardBreak" } as TiptapNode, ...l]));

const withContent = (block: TiptapNode, content: TiptapNode[]): TiptapNode => {
  const { content: _old, ...rest } = block;
  void _old;
  return content.length ? { ...rest, content } : rest;
};

export function isEmptyDoc(doc: TiptapDoc): boolean {
  return doc.content.every(isBlank);
}

/** Two pieces made one: the second follows the first, a paragraph break between them. */
export function mergeDocs(a: TiptapDoc, b: TiptapDoc): TiptapDoc {
  const content = [...a.content.filter((n) => !isBlank(n)), ...b.content.filter((n) => !isBlank(n))];
  return content.length ? { type: "doc", content } : emptyDoc();
}

/** Where a piece can be cut: before line `line` of block `block` (line 0 = between blocks). */
export type SplitPoint = { block: number; line: number };

export function splitDoc(doc: TiptapDoc, at: SplitPoint): [TiptapDoc, TiptapDoc] | null {
  const { block, line } = at;
  if (block < 0 || block >= doc.content.length || line < 0) return null;

  if (line === 0) {
    if (block === 0) return null;
    return [
      { type: "doc", content: doc.content.slice(0, block) },
      { type: "doc", content: doc.content.slice(block) },
    ];
  }
  const target = doc.content[block];
  const lines = blockLines(target);
  if (line >= lines.length) return null;
  return [
    { type: "doc", content: [...doc.content.slice(0, block), withContent(target, joinLines(lines.slice(0, line)))] },
    { type: "doc", content: [withContent(target, joinLines(lines.slice(line))), ...doc.content.slice(block + 1)] },
  ];
}

export type PreviewRun = { text: string; bold: boolean; italic: boolean };
export type PreviewLine = { runs: PreviewRun[]; text: string; at: SplitPoint };
export type PreviewBlock = {
  kind: "paragraph" | "heading";
  level: number;
  centered: boolean;
  lines: PreviewLine[];
};

/** The document as blocks of lines, each knowing the split point that would cut just before it. */
export function previewBlocks(doc: TiptapDoc): PreviewBlock[] {
  return doc.content
    .map((n, block) => {
      const attrs = (n.attrs ?? {}) as { textAlign?: string; level?: number };
      return {
        kind: n.type === "heading" ? ("heading" as const) : ("paragraph" as const),
        level: attrs.level ?? 2,
        centered: attrs.textAlign === "center",
        lines: blockLines(n).map((nodes, line) => {
          const runs = nodes
            .filter((x) => x.type === "text" && x.text)
            .map((x) => ({
              text: x.text as string,
              bold: !!x.marks?.some((m) => m.type === "bold"),
              italic: !!x.marks?.some((m) => m.type === "italic"),
            }));
          return { runs, text: runs.map((r) => r.text).join(""), at: { block, line } };
        }),
      };
    })
    .filter((b) => b.lines.some((l) => l.text.trim()));
}

/** The first few non-empty lines as plain text — a snippet to recognise a piece by. */
export function firstLines(doc: TiptapDoc, count: number): string[] {
  const out: string[] = [];
  for (const b of previewBlocks(doc)) {
    for (const l of b.lines) {
      if (l.text.trim()) out.push(l.text.trim());
      if (out.length >= count) return out;
    }
  }
  return out;
}
