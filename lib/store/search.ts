import { listChapterRecords } from "./chapters"
import { listNoteRecords, listResearchRecords } from "./notes"

export type SearchItemKind = "chapter" | "note" | "research";

export type SearchItem = {
  id: string;
  kind: SearchItemKind;
  title: string;
  snippet?: string;
  // Precomputed lowercase "title + body" blob the command palette filters
  // against client-side — simple substring search, not fuzzy ranking.
  searchText: string;
};

function truncate(text: string, max: number): string {
  const trimmed = text.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max).trimEnd()}…` : trimmed;
}

/** Flattens a Tiptap/ProseMirror JSON document down to its plain text. */
function extractPlainText(node: unknown, out: string[] = []): string[] {
  if (!node || typeof node !== "object") return out;
  const n = node as Record<string, unknown>;
  if (typeof n.text === "string") out.push(n.text);
  // @-mentions store their visible name as an attribute, not as text.
  if (n.type === "mention") {
    const label = (n.attrs as { label?: unknown } | undefined)?.label;
    if (typeof label === "string") out.push(label);
  }
  if (Array.isArray(n.content)) {
    for (const child of n.content) extractPlainText(child, out);
  }
  return out;
}

/** Every chapter/note/research entry in a project, flattened for the Cmd+K search. */
export async function listSearchIndexForProject(projectId: string): Promise<SearchItem[]> {
  const [chapters, notes, research] = await Promise.all([
    listChapterRecords(projectId),
    listNoteRecords(projectId),
    listResearchRecords(projectId),
  ])

  const chapterItems: SearchItem[] = chapters.map((c) => {
    const bodyText = extractPlainText(c.content).join(" ")
    return {
      id: c.id,
      kind: "chapter",
      title: c.title,
      snippet: bodyText ? truncate(bodyText, 120) : undefined,
      searchText: `${c.title} ${bodyText}`.toLowerCase(),
    }
  })

  const noteItems: SearchItem[] = notes.map((n) => ({
    id: n.id,
    kind: "note",
    title: n.title,
    snippet: n.content ? truncate(n.content, 120) : undefined,
    searchText: `${n.title} ${n.content ?? ""} ${(n.tags ?? []).join(" ")}`.toLowerCase(),
  }))

  const researchItems: SearchItem[] = research.map((r) => ({
    id: r.id,
    kind: "research",
    title: r.title,
    snippet: r.content ? truncate(r.content, 120) : r.url || undefined,
    searchText: `${r.title} ${r.content ?? ""} ${r.url ?? ""}`.toLowerCase(),
  }))

  return [...chapterItems, ...noteItems, ...researchItems]
}
