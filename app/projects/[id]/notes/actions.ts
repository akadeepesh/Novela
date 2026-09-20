"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import { Note } from "@/lib/models/note";
import { requireProject, requireUserId } from "@/lib/projects";

export async function createNoteAction(projectId: string) {
  await requireProject(projectId);
  const userId = await requireUserId();
  await connectDB();

  const note = await Note.create({
    projectId,
    ownerId: userId,
    title: "Untitled Note",
  });

  revalidatePath(`/projects/${projectId}/notes`);
  redirect(`/projects/${projectId}/notes/${note._id}`);
}

export async function deleteNoteAction(projectId: string, noteId: string) {
  const userId = await requireUserId();
  await connectDB();
  await Note.deleteOne({ _id: noteId, projectId, ownerId: userId });
  revalidatePath(`/projects/${projectId}/notes`);
}

export async function togglePinNoteAction(projectId: string, noteId: string, pinned: boolean) {
  const userId = await requireUserId();
  await connectDB();
  await Note.updateOne({ _id: noteId, projectId, ownerId: userId }, { $set: { pinned } });
  revalidatePath(`/projects/${projectId}/notes`);
}
