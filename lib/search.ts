import "server-only";
import { connectDB } from "@/lib/db";
import { Chapter } from "@/lib/models/chapter";
import { Note } from "@/lib/models/note";
import { ResearchEntry } from "@/lib/models/research-entry";
import { requireUserId } from "@/lib/projects";

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
  if (Array.isArray(n.content)) {
    for (const child of n.content) extractPlainText(child, out);
  }
  return out;
}

/** Every chapter/note/research entry in a project, flattened for the Cmd+K search. */
export async function listSearchIndexForProject(projectId: string): Promise<SearchItem[]> {
  const userId = await requireUserId();
  await connectDB();

  const [chapters, notes, research] = await Promise.all([
    Chapter.find({ projectId, ownerId: userId })
      .select({ title: 1, content: 1, order: 1 })
      .sort({ order: 1 })
      .lean<Record<string, unknown>[]>(),
    Note.find({ projectId, ownerId: userId })
      .select({ title: 1, content: 1, tags: 1 })
      .lean<Record<string, unknown>[]>(),
    ResearchEntry.find({ projectId, ownerId: userId })
      .select({ title: 1, content: 1, url: 1 })
      .lean<Record<string, unknown>[]>(),
  ]);

  const chapterItems: SearchItem[] = chapters.map((c) => {
    const title = c.title as string;
    const bodyText = extractPlainText(c.content).join(" ");
    return {
      id: String(c._id),
      kind: "chapter",
      title,
      snippet: bodyText ? truncate(bodyText, 120) : undefined,
      searchText: `${title} ${bodyText}`.toLowerCase(),
    };
  });

  const noteItems: SearchItem[] = notes.map((n) => {
    const title = n.title as string;
    const content = (n.content as string) ?? "";
    const tags = (n.tags as string[]) ?? [];
    return {
      id: String(n._id),
      kind: "note",
      title,
      snippet: content ? truncate(content, 120) : undefined,
      searchText: `${title} ${content} ${tags.join(" ")}`.toLowerCase(),
    };
  });

  const researchItems: SearchItem[] = research.map((r) => {
    const title = r.title as string;
    const content = (r.content as string) ?? "";
    const url = (r.url as string) ?? "";
    return {
      id: String(r._id),
      kind: "research",
      title,
      snippet: content ? truncate(content, 120) : url || undefined,
      searchText: `${title} ${content} ${url}`.toLowerCase(),
    };
  });

  return [...chapterItems, ...noteItems, ...researchItems];
}
