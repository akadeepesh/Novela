"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import { PlotThread } from "@/lib/models/plot-thread";
import { requireProject, requireUserId } from "@/lib/projects";
import { nextDefaultName } from "@/lib/default-name";
import { safeAction } from "@/lib/safe-action";

export const createPlotThreadAction = safeAction(
  "createPlotThreadAction",
  async (projectId: string): Promise<void> => {
    await requireProject(projectId);
    const userId = await requireUserId();
    await connectDB();

    const existing = await PlotThread.find({ projectId, ownerId: userId })
      .select("title")
      .lean<{ title: string }[]>();

    const thread = await PlotThread.create({
      projectId,
      ownerId: userId,
      title: nextDefaultName(
        existing.map((t) => t.title),
        "New Thread"
      ),
    });

    revalidatePath(`/projects/${projectId}/plot`);
    redirect(`/projects/${projectId}/plot/${thread._id}`);
  },
  () => undefined,
  { ids: [0] }
);

export const deletePlotThreadAction = safeAction(
  "deletePlotThreadAction",
  async (projectId: string, threadId: string) => {
    const userId = await requireUserId();
    await connectDB();
    await PlotThread.deleteOne({ _id: threadId, projectId, ownerId: userId });
    revalidatePath(`/projects/${projectId}/plot`);
  },
  () => undefined,
  { ids: [0, 1] }
);
