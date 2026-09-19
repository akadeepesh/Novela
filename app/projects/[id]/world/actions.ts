"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import { WorldEntry } from "@/lib/models/world-entry";
import { requireUserId } from "@/lib/projects";

export async function createWorldEntryAction(projectId: string) {
  const userId = await requireUserId();
  await connectDB();

  const count = await WorldEntry.countDocuments({ projectId });

  const entry = await WorldEntry.create({
    projectId,
    ownerId: userId,
    name: `New Entry ${count + 1}`,
  });

  revalidatePath(`/projects/${projectId}/world`);
  redirect(`/projects/${projectId}/world/${entry._id}`);
}

export async function deleteWorldEntryAction(projectId: string, entryId: string) {
  const userId = await requireUserId();
  await connectDB();
  await WorldEntry.deleteOne({ _id: entryId, projectId, ownerId: userId });
  revalidatePath(`/projects/${projectId}/world`);
}
