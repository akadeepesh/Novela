"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import { WorldEntry } from "@/lib/models/world-entry";
import { requireProject, requireUserId } from "@/lib/projects";
import { nextDefaultName } from "@/lib/default-name";
import { safeAction } from "@/lib/safe-action";

export const createWorldEntryAction = safeAction(
  "createWorldEntryAction",
  async (projectId: string): Promise<void> => {
    await requireProject(projectId);
    const userId = await requireUserId();
    await connectDB();

    const existing = await WorldEntry.find({ projectId, ownerId: userId })
      .select("name")
      .lean<{ name: string }[]>();

    const entry = await WorldEntry.create({
      projectId,
      ownerId: userId,
      name: nextDefaultName(
        existing.map((e) => e.name),
        "New Entry"
      ),
    });

    revalidatePath(`/projects/${projectId}/world`);
    redirect(`/projects/${projectId}/world/${entry._id}`);
  },
  () => undefined,
  { ids: [0] }
);

export const deleteWorldEntryAction = safeAction(
  "deleteWorldEntryAction",
  async (projectId: string, entryId: string) => {
    const userId = await requireUserId();
    await connectDB();
    await WorldEntry.deleteOne({ _id: entryId, projectId, ownerId: userId });
    revalidatePath(`/projects/${projectId}/world`);
  },
  () => undefined,
  { ids: [0, 1] }
);
