"use server";

import { z } from "zod";
import { formString } from "@/lib/form";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import { Note } from "@/lib/models/note";
import { requireUserId } from "@/lib/projects";
import { safeAction, GENERIC_ERROR } from "@/lib/safe-action";

const schema = z.object({
  title: z.string().trim().max(160).optional(),
  content: z.string().trim().max(20000).optional(),
  tags: z.string().trim().max(500).optional(),
  pinned: z.boolean().optional(),
});

export type UpdateNoteState = {
  error?: string;
  success?: boolean;
};

export const updateNoteAction = safeAction(
  "updateNoteAction",
  async (
    projectId: string,
    noteId: string,
    _prevState: UpdateNoteState,
    formData: FormData
  ): Promise<UpdateNoteState> => {
    const userId = await requireUserId();

    const parsed = schema.safeParse({
      title: formString(formData, "title"),
      content: formString(formData, "content"),
      tags: formString(formData, "tags"),
      pinned: formData.get("pinned") === "on",
    });

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Check the fields and try again." };
    }

    const { tags, ...rest } = parsed.data;
    const tagList = tags
      ? tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : [];

    await connectDB();
    const result = await Note.updateOne(
      { _id: noteId, projectId, ownerId: userId },
      { $set: { ...rest, title: rest.title || "Untitled Note", tags: tagList } }
    );

    if (result.matchedCount === 0) {
      return { error: "Couldn't find this note." };
    }

    revalidatePath(`/projects/${projectId}/notes`);
    revalidatePath(`/projects/${projectId}/notes/${noteId}`);
    return { success: true };
  },
  () => ({ error: GENERIC_ERROR }),
  { ids: [0, 1] }
);
