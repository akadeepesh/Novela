import type { Run, TiptapDoc, TiptapMark, TiptapNode } from "./types";

/** Merges neighbours that share a style and drops empties. */
export function coalesce(runs: Run[]): Run[] {
  const out: Run[] = [];
  for (const r of runs) {
    if (!r.text) continue;
    const last = out[out.length - 1];
    if (last && last.bold === r.bold && last.italic === r.italic) last.text += r.text;
    else out.push({ ...r });
  }
  return out;
}

/** Runs → Tiptap text nodes, with whitespace tidied at the edges. */
export function runsToNodes(runs: Run[]): TiptapNode[] {
  const tidy = coalesce(runs.map((r) => ({ ...r, text: r.text.replace(/[ \t]+/g, " ") })));
  if (tidy.length) {
    tidy[0].text = tidy[0].text.replace(/^\s+/, "");
    tidy[tidy.length - 1].text = tidy[tidy.length - 1].text.replace(/\s+$/, "");
  }
  const merged = coalesce(tidy);
  for (let i = 1; i < merged.length; i++) {
    if (/\s$/.test(merged[i - 1].text)) merged[i].text = merged[i].text.replace(/^\s+/, "");
  }
  return merged.filter((r) => r.text).map((r) => {
    const marks: TiptapMark[] = [];
    if (r.bold) marks.push({ type: "bold" });
    if (r.italic) marks.push({ type: "italic" });
    const node: TiptapNode = { type: "text", text: r.text };
    if (marks.length) node.marks = marks;
    return node;
  });
}

/** Lines of runs → one inline list, with a hard break between lines (how poetry lines are stored in the editor). */
export function linesToInline(lines: Run[][]): TiptapNode[] {
  const nodes: TiptapNode[] = [];
  lines.forEach((runs, i) => {
    if (i > 0) nodes.push({ type: "hardBreak" });
    nodes.push(...runsToNodes(runs));
  });
  return nodes;
}

export function paragraph(content: TiptapNode[], center: boolean): TiptapNode {
  const node: TiptapNode = { type: "paragraph" };
  if (center) node.attrs = { textAlign: "center" };
  if (content.length) node.content = content;
  return node;
}

export function heading(level: 2 | 3, content: TiptapNode[], center: boolean): TiptapNode {
  return { type: "heading", attrs: center ? { level, textAlign: "center" } : { level }, content };
}

export function emptyDoc(): TiptapDoc {
  return { type: "doc", content: [{ type: "paragraph" }] };
}

export function docText(doc: TiptapDoc): string {
  const parts: string[] = [];
  const walk = (n: TiptapNode) => {
    if (n.type === "text" && n.text) parts.push(n.text);
    else if (n.type === "hardBreak") parts.push(" ");
    n.content?.forEach(walk);
    if (n.type === "paragraph" || n.type === "heading") parts.push(" ");
  };
  doc.content.forEach(walk);
  return parts.join("");
}

export function countWords(doc: TiptapDoc): number {
  return docText(doc).split(/\s+/).filter(Boolean).length;
}
