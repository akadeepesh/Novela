"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import { Character } from "@/lib/models/character";
import { requireProject, requireUserId } from "@/lib/projects";

export async function createCharacterAction(projectId: string) {
  await requireProject(projectId);
  const userId = await requireUserId();
  await connectDB();

  const count = await Character.countDocuments({ projectId });

  const character = await Character.create({
    projectId,
    ownerId: userId,
    name: `New Character ${count + 1}`,
  });

  revalidatePath(`/projects/${projectId}/characters`);
  redirect(`/projects/${projectId}/characters/${character._id}`);
}

export async function deleteCharacterAction(projectId: string, characterId: string) {
  const userId = await requireUserId();
  await connectDB();
  await Character.deleteOne({ _id: characterId, projectId, ownerId: userId });
  revalidatePath(`/projects/${projectId}/characters`);
}
