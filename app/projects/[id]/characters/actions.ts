"use server";

import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import { Character } from "@/lib/models/character";
import { ownsActiveProject, requireUserId } from "@/lib/projects";
import { safeAction } from "@/lib/safe-action";

export const deleteCharacterAction = safeAction(
  "deleteCharacterAction",
  async (projectId: string, characterId: string) => {
    const userId = await requireUserId();
    if (!(await ownsActiveProject(userId, projectId))) return;
    await connectDB();
    await Character.deleteOne({ _id: characterId, projectId, ownerId: userId });
    revalidatePath(`/projects/${projectId}/characters`);
  },
  () => undefined,
  { ids: [0, 1] }
);
