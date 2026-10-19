"use server";

import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import { WorldEntry } from "@/lib/models/world-entry";
import { ownsActiveProject, requireUserId } from "@/lib/projects";
import { safeAction } from "@/lib/safe-action";

export const deleteWorldEntryAction = safeAction(
  "deleteWorldEntryAction",
  async (projectId: string, entryId: string) => {
    const userId = await requireUserId();
    if (!(await ownsActiveProject(userId, projectId))) return;
    await connectDB();
    await WorldEntry.deleteOne({ _id: entryId, projectId, ownerId: userId });
    revalidatePath(`/projects/${projectId}/world`);
  },
  () => undefined,
  { ids: [0, 1] }
);
