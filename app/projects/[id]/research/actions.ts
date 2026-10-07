"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import { ResearchEntry } from "@/lib/models/research-entry";
import { requireProject, requireUserId } from "@/lib/projects";
import { fetchUrlPreview } from "@/lib/url-preview";
import {
  serializeResearchEntrySummary,
  type SerializedResearchEntrySummary,
} from "@/lib/research-entries";
import { safeAction } from "@/lib/safe-action";

const urlSchema = z.string().trim().min(1).max(2000);

/**
 * The single URL-paste input on the Research board (Part 7.2, option b):
 * paste a link and we fetch its title/image/favicon server-side, turning
 * it into a bookmark card — no form to fill in.
 */
export const createLinkEntryAction = safeAction(
  "createLinkEntryAction",
  async (
    projectId: string,
    rawUrl: string
  ): Promise<{ ok: boolean; entry?: SerializedResearchEntrySummary; error?: string }> => {
    await requireProject(projectId);
    const userId = await requireUserId();

    const parsedUrl = urlSchema.safeParse(rawUrl);
    if (!parsedUrl.success) return { ok: false, error: "Paste a link first." };

    // A bare "example.com" with no scheme is still what most people paste —
    // let URL do the normalizing rather than rejecting it outright.
    let normalized = parsedUrl.data;
    if (!/^https?:\/\//i.test(normalized)) normalized = `https://${normalized}`;

    const preview = await fetchUrlPreview(normalized);
    if (!preview) return { ok: false, error: "That doesn't look like a valid link." };

    await connectDB();
    const entry = await ResearchEntry.create({
      projectId,
      ownerId: userId,
      title: preview.title,
      type: "link",
      url: normalized,
      content: "",
      imageUrl: preview.imageUrl,
      faviconUrl: preview.faviconUrl,
      siteName: preview.siteName,
    });

    revalidatePath(`/projects/${projectId}/research`);
    return { ok: true, entry: serializeResearchEntrySummary(entry.toObject()) };
  },
  () => ({ ok: false }),
  { ids: [0] }
);

const noteSchema = z.object({
  title: z.string().trim().max(160).optional(),
  content: z.string().trim().max(8000).optional(),
});

/**
 * The manual "quick note" escape hatch (Part 7.2) for research that has no
 * URL — a book, a conversation, anything offline.
 */
export const createQuickNoteEntryAction = safeAction(
  "createQuickNoteEntryAction",
  async (
    projectId: string,
    input: { title?: string; content?: string }
  ): Promise<{ ok: boolean; entry?: SerializedResearchEntrySummary }> => {
    await requireProject(projectId);
    const userId = await requireUserId();

    const parsed = noteSchema.safeParse(input);
    if (!parsed.success) return { ok: false };
    if (!parsed.data.title?.trim() && !parsed.data.content?.trim()) return { ok: false };

    await connectDB();
    const entry = await ResearchEntry.create({
      projectId,
      ownerId: userId,
      title: parsed.data.title?.trim() || "Untitled note",
      type: "note",
      content: parsed.data.content?.trim() || "",
    });

    revalidatePath(`/projects/${projectId}/research`);
    return { ok: true, entry: serializeResearchEntrySummary(entry.toObject()) };
  },
  () => ({ ok: false }),
  { ids: [0] }
);

export const deleteResearchEntryAction = safeAction(
  "deleteResearchEntryAction",
  async (projectId: string, entryId: string) => {
    const userId = await requireUserId();
    await connectDB();
    await ResearchEntry.deleteOne({ _id: entryId, projectId, ownerId: userId });
    revalidatePath(`/projects/${projectId}/research`);
  },
  () => undefined,
  { ids: [0, 1] }
);

const fieldsSchema = z.object({
  title: z.string().trim().max(160).optional(),
  content: z.string().trim().max(8000).optional(),
});

export type SaveResearchEntryFieldsInput = z.infer<typeof fieldsSchema>;

/**
 * Inline caption/title edits fired from a card's debounced autosave. Link
 * cards only ever send `content` (the "why this matters" caption) since
 * their title comes from the fetched preview; quick notes send both.
 */
export const saveResearchEntryFieldsAction = safeAction(
  "saveResearchEntryFieldsAction",
  async (
    projectId: string,
    entryId: string,
    input: SaveResearchEntryFieldsInput
  ): Promise<{ ok: boolean }> => {
    const userId = await requireUserId();
    const parsed = fieldsSchema.safeParse(input);
    if (!parsed.success) return { ok: false };

    const update: Record<string, unknown> = {};
    if (parsed.data.title !== undefined) update.title = parsed.data.title.trim() || "Untitled";
    if (parsed.data.content !== undefined) update.content = parsed.data.content;

    await connectDB();
    const result = await ResearchEntry.updateOne(
      { _id: entryId, projectId, ownerId: userId },
      { $set: update }
    );

    revalidatePath(`/projects/${projectId}/research`);
    return { ok: result.matchedCount > 0 };
  },
  () => ({ ok: false }),
  { ids: [0, 1] }
);
