"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import { Note } from "@/lib/models/note";
import { requireProject, requireUserId } from "@/lib/projects";
import { serializeNoteSummary, type SerializedNoteSummary } from "@/lib/notes";
import { safeAction } from "@/lib/safe-action";
import { LIMITS, limitMessage } from "@/lib/limits";

const createSchema = z.object({
  title: z.string().trim().max(160).optional(),
  content: z.string().trim().max(20000).optional(),
});

/**
 * Creates a note straight from the "Take a note…" composer — no dialog,
 * no separate page, no redirect (Part 7.1). Returns the created note so
 * the grid can drop it straight into local state.
 */
export const createNoteInlineAction = safeAction(
  "createNoteInlineAction",
  async (
    projectId: string,
    input: { title?: string; content?: string }
  ): Promise<{ ok: boolean; note?: SerializedNoteSummary; error?: string }> => {
    await requireProject(projectId);
    const userId = await requireUserId();

    const parsed = createSchema.safeParse(input);
    if (!parsed.success) return { ok: false };

    // Matches Keep: clicking away from a blank composer creates nothing.
    if (!parsed.data.title?.trim() && !parsed.data.content?.trim()) {
      return { ok: false };
    }

    await connectDB();
    if ((await Note.countDocuments({ projectId, ownerId: userId })) >= LIMITS.notes) {
      return { ok: false, error: limitMessage("notes") };
    }
    const note = await Note.create({
      projectId,
      ownerId: userId,
      title: parsed.data.title?.trim() || "Untitled Note",
      content: parsed.data.content?.trim() || "",
    });

    revalidatePath(`/projects/${projectId}/notes`);
    return { ok: true, note: serializeNoteSummary(note.toObject()) };
  },
  () => ({ ok: false }),
  { ids: [0] }
);

const saveSchema = z.object({
  title: z.string().trim().max(160).optional(),
  content: z.string().trim().max(20000).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
});

export type SaveNoteInput = z.infer<typeof saveSchema>;

/**
 * Typed, direct-call save used by a note card's debounced autosave — the
 * inline-editing counterpart to the old form-based update action. Only
 * touches the fields it's actually given.
 */
export const saveNoteAction = safeAction(
  "saveNoteAction",
  async (projectId: string, noteId: string, input: SaveNoteInput): Promise<{ ok: boolean }> => {
    const userId = await requireUserId();
    const parsed = saveSchema.safeParse(input);
    if (!parsed.success) return { ok: false };

    const update: Record<string, unknown> = {};
    if (parsed.data.title !== undefined) update.title = parsed.data.title.trim() || "Untitled Note";
    if (parsed.data.content !== undefined) update.content = parsed.data.content;
    if (parsed.data.tags !== undefined) update.tags = parsed.data.tags;

    await connectDB();
    const result = await Note.updateOne(
      { _id: noteId, projectId, ownerId: userId },
      { $set: update }
    );

    revalidatePath(`/projects/${projectId}/notes`);
    return { ok: result.matchedCount > 0 };
  },
  () => ({ ok: false }),
  { ids: [0, 1] }
);

export const deleteNoteAction = safeAction(
  "deleteNoteAction",
  async (projectId: string, noteId: string) => {
    const userId = await requireUserId();
    await connectDB();
    await Note.deleteOne({ _id: noteId, projectId, ownerId: userId });
    revalidatePath(`/projects/${projectId}/notes`);
  },
  () => undefined,
  { ids: [0, 1] }
);

export const togglePinNoteAction = safeAction(
  "togglePinNoteAction",
  async (projectId: string, noteId: string, pinned: boolean) => {
    const userId = await requireUserId();
    await connectDB();
    await Note.updateOne({ _id: noteId, projectId, ownerId: userId }, { $set: { pinned } });
    revalidatePath(`/projects/${projectId}/notes`);
  },
  () => undefined,
  { ids: [0, 1] }
);
