"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import { Note } from "@/lib/models/note";
import { requireUserId } from "@/lib/projects";

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

export async function updateNoteAction(
  projectId: string,
  noteId: string,
  _prevState: UpdateNoteState,
  formData: FormData
): Promise<UpdateNoteState> {
  const userId = await requireUserId();

  const parsed = schema.safeParse({
    title: (formData.get("title") as string) || undefined,
    content: (formData.get("content") as string) || undefined,
    tags: (formData.get("tags") as string) || undefined,
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
}
