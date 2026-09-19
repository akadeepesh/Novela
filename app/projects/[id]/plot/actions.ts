"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import { PlotThread } from "@/lib/models/plot-thread";
import { requireUserId } from "@/lib/projects";

export async function createPlotThreadAction(projectId: string) {
  const userId = await requireUserId();
  await connectDB();

  const count = await PlotThread.countDocuments({ projectId });

  const thread = await PlotThread.create({
    projectId,
    ownerId: userId,
    title: `New Thread ${count + 1}`,
  });

  revalidatePath(`/projects/${projectId}/plot`);
  redirect(`/projects/${projectId}/plot/${thread._id}`);
}

export async function deletePlotThreadAction(projectId: string, threadId: string) {
  const userId = await requireUserId();
  await connectDB();
  await PlotThread.deleteOne({ _id: threadId, projectId, ownerId: userId });
  revalidatePath(`/projects/${projectId}/plot`);
}
