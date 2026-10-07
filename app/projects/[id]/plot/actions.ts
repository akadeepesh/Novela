"use server";

import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import { PlotThread } from "@/lib/models/plot-thread";
import { requireUserId } from "@/lib/projects";
import { safeAction } from "@/lib/safe-action";

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
