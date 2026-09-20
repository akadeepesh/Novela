import "server-only";
import { connectDB } from "@/lib/db";
import { Character } from "@/lib/models/character";
import { WorldEntry } from "@/lib/models/world-entry";
import { PlotThread } from "@/lib/models/plot-thread";
import { Chapter } from "@/lib/models/chapter";
import { requireUserId } from "@/lib/projects";
import { characterRoleLabel, type CharacterRole } from "@/lib/character-config";
import { worldEntryTypeLabel, type WorldEntryType } from "@/lib/world-config";
import { plotStatusLabel, type PlotStatus } from "@/lib/plot-config";

export type MentionableType = "character" | "world" | "plot";

export type Mentionable = {
  id: string;
  type: MentionableType;
  label: string;
  aliases: string[];
  // Short "kind — detail" blurb embedded into the mention node at insert
  // time, so hovering "@Elena" in the editor shows who she is without a
  // extra fetch. Trade-off: it's a snapshot, not live — it won't update if
  // the profile changes later, same as any other text already written.
  preview: string;
};

function truncate(text: string, max = 100): string {
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

function buildPreview(kind: string, detail?: string): string {
  return detail ? `${kind} — ${truncate(detail)}` : kind;
}

/** All characters/world entries/plot threads in a project, for the @-mention search. */
export async function listMentionablesForProject(projectId: string): Promise<Mentionable[]> {
  const userId = await requireUserId();
  await connectDB();

  const [characters, worldEntries, plotThreads] = await Promise.all([
    Character.find({ projectId, ownerId: userId })
      .select({ name: 1, role: 1, aliases: 1, appearance: 1 })
      .lean<Record<string, unknown>[]>(),
    WorldEntry.find({ projectId, ownerId: userId })
      .select({ name: 1, type: 1, aliases: 1, description: 1 })
      .lean<Record<string, unknown>[]>(),
    PlotThread.find({ projectId, ownerId: userId })
      .select({ title: 1, status: 1, aliases: 1, description: 1 })
      .lean<Record<string, unknown>[]>(),
  ]);

  const characterItems: Mentionable[] = characters.map((c) => ({
    id: String(c._id),
    type: "character",
    label: c.name as string,
    aliases: (c.aliases as string[]) ?? [],
    preview: buildPreview(
      characterRoleLabel((c.role as CharacterRole) ?? "supporting"),
      c.appearance as string | undefined
    ),
  }));

  const worldItems: Mentionable[] = worldEntries.map((w) => ({
    id: String(w._id),
    type: "world",
    label: w.name as string,
    aliases: (w.aliases as string[]) ?? [],
    preview: buildPreview(
      worldEntryTypeLabel((w.type as WorldEntryType) ?? "location"),
      w.description as string | undefined
    ),
  }));

  const plotItems: Mentionable[] = plotThreads.map((p) => ({
    id: String(p._id),
    type: "plot",
    label: p.title as string,
    aliases: (p.aliases as string[]) ?? [],
    preview: buildPreview(
      plotStatusLabel((p.status as PlotStatus) ?? "planned"),
      p.description as string | undefined
    ),
  }));

  return [...characterItems, ...worldItems, ...plotItems].sort((a, b) =>
    a.label.localeCompare(b.label)
  );
}

type MentionRef = { type: MentionableType; id: string };

/** Recursively walks a Tiptap/ProseMirror JSON document collecting mention node references. */
export function extractMentionRefs(content: unknown): MentionRef[] {
  const found: MentionRef[] = [];

  function walk(node: unknown) {
    if (!node || typeof node !== "object") return;
    const n = node as Record<string, unknown>;

    if (n.type === "mention" && n.attrs && typeof n.attrs === "object") {
      const attrs = n.attrs as Record<string, unknown>;
      if (typeof attrs.id === "string" && typeof attrs.entityType === "string") {
        found.push({ type: attrs.entityType as MentionableType, id: attrs.id });
      }
    }

    if (Array.isArray(n.content)) {
      for (const child of n.content) walk(child);
    }
  }

  walk(content);
  return found;
}

export type ChapterMentionRef = { id: string; title: string; order: number };

/** Chapters (in a project) whose content mentions the given entity — the "Appears in" backlink. */
export async function listChaptersMentioning(
  projectId: string,
  entityType: MentionableType,
  entityId: string
): Promise<ChapterMentionRef[]> {
  const userId = await requireUserId();
  await connectDB();

  const docs = await Chapter.find({ projectId, ownerId: userId })
    .select({ title: 1, order: 1, content: 1 })
    .sort({ order: 1 })
    .lean<Record<string, unknown>[]>();

  const matches: ChapterMentionRef[] = [];
  for (const doc of docs) {
    const refs = extractMentionRefs(doc.content);
    if (refs.some((r) => r.type === entityType && r.id === entityId)) {
      matches.push({
        id: String(doc._id),
        title: doc.title as string,
        order: doc.order as number,
      });
    }
  }
  return matches;
}
