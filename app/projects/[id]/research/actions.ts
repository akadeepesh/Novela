"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import { ResearchEntry } from "@/lib/models/research-entry";
import { requireProject, requireUserId } from "@/lib/projects";

export async function createResearchEntryAction(projectId: string) {
  await requireProject(projectId);
  const userId = await requireUserId();
  await connectDB();

  const count = await ResearchEntry.countDocuments({ projectId });

  const entry = await ResearchEntry.create({
    projectId,
    ownerId: userId,
    title: `New Entry ${count + 1}`,
  });

  revalidatePath(`/projects/${projectId}/research`);
  redirect(`/projects/${projectId}/research/${entry._id}`);
}

export async function deleteResearchEntryAction(projectId: string, entryId: string) {
  const userId = await requireUserId();
  await connectDB();
  await ResearchEntry.deleteOne({ _id: entryId, projectId, ownerId: userId });
  revalidatePath(`/projects/${projectId}/research`);
}
