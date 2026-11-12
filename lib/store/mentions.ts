import { listChapterRecords } from "./chapters"
import { listCharacterRecords, listPlotThreadRecords, listWorldEntryRecords } from "./bible"
import { characterRoleLabel } from "@/lib/character-config"
import { worldEntryTypeLabel } from "@/lib/world-config"
import { plotStatusLabel } from "@/lib/plot-config"

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
  const [characters, worldEntries, plotThreads] = await Promise.all([
    listCharacterRecords(projectId),
    listWorldEntryRecords(projectId),
    listPlotThreadRecords(projectId),
  ])

  const items: Mentionable[] = [
    ...characters.map((c) => ({
      id: c.id,
      type: "character" as const,
      label: c.name,
      aliases: c.aliases ?? [],
      preview: buildPreview(characterRoleLabel(c.role ?? "supporting"), c.appearance),
    })),
    ...worldEntries.map((w) => ({
      id: w.id,
      type: "world" as const,
      label: w.name,
      aliases: w.aliases ?? [],
      preview: buildPreview(worldEntryTypeLabel(w.type ?? "location"), w.description),
    })),
    ...plotThreads.map((p) => ({
      id: p.id,
      type: "plot" as const,
      label: p.title,
      aliases: p.aliases ?? [],
      preview: buildPreview(plotStatusLabel(p.status ?? "planned"), p.description),
    })),
  ]
  return items.sort((a, b) => a.label.localeCompare(b.label))
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

export type ChapterMentionRef = { id: string; title: string; order: number }

/** Chapters whose content mentions the given entity: the "Appears in" backlink. */
export async function listChaptersMentioning(
  projectId: string,
  entityType: MentionableType,
  entityId: string
): Promise<ChapterMentionRef[]> {
  const chapters = await listChapterRecords(projectId)
  return chapters
    .filter((c) => extractMentionRefs(c.content).some((r) => r.type === entityType && r.id === entityId))
    .map((c) => ({ id: c.id, title: c.title, order: c.order }))
}
