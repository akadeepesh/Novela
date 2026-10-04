/**
 * Review state comes back from the browser, so it is treated as untrusted:
 * rebuilt field by field from a whitelist (the node and mark types Step 5
 * emits, nothing else) before it is saved or turned into a real manuscript.
 */
import type { TiptapDoc, TiptapNode } from "@/lib/import/format/types";
import { BACKGROUND_PRESETS } from "@/lib/manuscript-config";
import { countWords, emptyDoc } from "./doc-ops";
import type { BackgroundChoice, PresetId, ReviewPiece, ReviewState, TitleSource } from "./types";

const MAX_PIECES = 400;
const MAX_NODES = 20_000;
const TITLE_SOURCES: TitleSource[] = ["heading", "first-line", "fallback", "edited"];
const PRESET_IDS = BACKGROUND_PRESETS.map((p) => p.id) as string[];

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
const int = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : fallback);

function cleanInline(raw: unknown, budget: { n: number }): TiptapNode | null {
  if (!raw || typeof raw !== "object" || ++budget.n > MAX_NODES) return null;
  const n = raw as { type?: unknown; text?: unknown; marks?: unknown };
  if (n.type === "hardBreak") return { type: "hardBreak" };
  if (n.type !== "text" || typeof n.text !== "string" || !n.text) return null;
  const marks = Array.isArray(n.marks)
    ? (n.marks as { type?: unknown }[])
        .map((m) => m?.type)
        .filter((t): t is "bold" | "italic" => t === "bold" || t === "italic")
        .map((type) => ({ type }))
    : [];
  const node: TiptapNode = { type: "text", text: n.text.slice(0, 20_000) };
  if (marks.length) node.marks = marks;
  return node;
}

export function sanitizeDoc(raw: unknown): TiptapDoc {
  const budget = { n: 0 };
  const blocks = (raw as { content?: unknown })?.content;
  if (!Array.isArray(blocks)) return emptyDoc();
  const content: TiptapNode[] = [];
  for (const b of blocks) {
    if (!b || typeof b !== "object" || ++budget.n > MAX_NODES) continue;
    const block = b as { type?: unknown; attrs?: { textAlign?: unknown; level?: unknown }; content?: unknown };
    if (block.type !== "paragraph" && block.type !== "heading") continue;
    const inline = (Array.isArray(block.content) ? block.content : [])
      .map((c) => cleanInline(c, budget))
      .filter((c): c is TiptapNode => !!c);
    const attrs: Record<string, unknown> = {};
    if (block.type === "heading") attrs.level = block.attrs?.level === 3 ? 3 : 2;
    if (block.attrs?.textAlign === "center") attrs.textAlign = "center";
    const node: TiptapNode = { type: block.type };
    if (Object.keys(attrs).length) node.attrs = attrs;
    if (inline.length) node.content = inline;
    content.push(node);
  }
  return content.length ? { type: "doc", content } : emptyDoc();
}

function sanitizeBackground(raw: unknown): BackgroundChoice {
  const b = raw as { kind?: unknown; id?: unknown } | null;
  if (b?.kind === "preset" && typeof b.id === "string" && PRESET_IDS.includes(b.id)) {
    return { kind: "preset", id: b.id as PresetId };
  }
  return { kind: "image" };
}

export function sanitizeReviewState(raw: unknown): ReviewState | null {
  const s = raw as Partial<ReviewState> | null;
  if (!s || typeof s !== "object" || !Array.isArray(s.pieces) || s.pieces.length === 0 || s.pieces.length > MAX_PIECES) return null;

  const seen = new Set<string>();
  const pieces: ReviewPiece[] = [];
  for (const p of s.pieces as Partial<ReviewPiece>[]) {
    const id = str(p?.id, 40);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const doc = sanitizeDoc(p.doc);
    pieces.push({
      id,
      title: str(p.title, 200).trim() || "Untitled",
      titleSource: TITLE_SOURCES.includes(p.titleSource as TitleSource) ? (p.titleSource as TitleSource) : "edited",
      startPage: Math.max(1, int(p.startPage, 1)),
      endPage: Math.max(1, int(p.endPage, 1)),
      layout: p.layout === "prose" ? "prose" : "verse",
      confidence: p.confidence === "low" || p.confidence === "medium" ? p.confidence : "high",
      flags: Array.isArray(p.flags) ? p.flags.slice(0, 6).map((f) => str(f, 300)).filter(Boolean) : [],
      checked: p.checked === true,
      doc,
      wordCount: countWords(doc),
    });
  }
  if (!pieces.length) return null;
  return {
    version: 1,
    bookTitle: str(s.bookTitle, 200).trim() || "My book",
    pieces,
    background: sanitizeBackground(s.background),
    useCover: s.useCover === true,
    seq: int(s.seq, 0),
  };
}
