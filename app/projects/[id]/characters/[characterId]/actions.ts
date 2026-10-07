"use server";

import { z } from "zod";
import { formString } from "@/lib/form";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import { Character } from "@/lib/models/character";
import { requireProject, requireUserId } from "@/lib/projects";
import { CHARACTER_ROLES, type CharacterRole } from "@/lib/character-config";
import { safeAction, GENERIC_ERROR } from "@/lib/safe-action";

const ROLE_VALUES = CHARACTER_ROLES.map((r) => r.value) as [CharacterRole, ...CharacterRole[]];

const schema = z.object({
  name: z.string().trim().min(1, "Give this character a name").max(120),
  role: z.enum(ROLE_VALUES),
  aliases: z.string().trim().max(500).optional(),
  imageUrl: z.string().trim().max(2000).optional(),
  appearance: z.string().trim().max(4000).optional(),
  personality: z.string().trim().max(4000).optional(),
  backstory: z.string().trim().max(4000).optional(),
  notes: z.string().trim().max(4000).optional(),
});

export type UpdateCharacterState = {
  error?: string;
  success?: boolean;
};

export const updateCharacterAction = safeAction(
  "updateCharacterAction",
  async (
    projectId: string,
    characterId: string,
    _prevState: UpdateCharacterState,
    formData: FormData
  ): Promise<UpdateCharacterState> => {
    const userId = await requireUserId();

    const parsed = schema.safeParse({
      name: formData.get("name"),
      role: formData.get("role"),
      aliases: formString(formData, "aliases"),
      imageUrl: formString(formData, "imageUrl"),
      appearance: formString(formData, "appearance"),
      personality: formString(formData, "personality"),
      backstory: formString(formData, "backstory"),
      notes: formString(formData, "notes"),
    });

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Check the fields and try again." };
    }

    const { aliases, ...rest } = parsed.data;
    const aliasList = aliases
      ? aliases
          .split(",")
          .map((a) => a.trim())
          .filter(Boolean)
      : [];

    await connectDB();
    const result = await Character.updateOne(
      { _id: characterId, projectId, ownerId: userId },
      { $set: { ...rest, aliases: aliasList } }
    );

    if (result.matchedCount === 0) {
      return { error: "Couldn't find this character." };
    }

    revalidatePath(`/projects/${projectId}/characters`);
    revalidatePath(`/projects/${projectId}/characters/${characterId}`);
    return { success: true };
  },
  () => ({ error: GENERIC_ERROR }),
  { ids: [0, 1] }
);

/**
 * Creates the record from the blank "new" form. Nothing exists in the database
 * until this runs, so opening the form and walking away leaves no stray record.
 */
export const createCharacterFromFormAction = safeAction(
  "createCharacterFromFormAction",
  async (
    projectId: string,
    _prevState: UpdateCharacterState,
    formData: FormData
  ): Promise<UpdateCharacterState> => {
    await requireProject(projectId);
    const userId = await requireUserId();

    const parsed = schema.safeParse({
      name: formData.get("name"),
      role: formData.get("role"),
      aliases: formString(formData, "aliases"),
      imageUrl: formString(formData, "imageUrl"),
      appearance: formString(formData, "appearance"),
      personality: formString(formData, "personality"),
      backstory: formString(formData, "backstory"),
      notes: formString(formData, "notes"),
    });

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Check the fields and try again." };
    }

    const { aliases, ...rest } = parsed.data;
    const aliasList = aliases
      ? aliases
          .split(",")
          .map((a) => a.trim())
          .filter(Boolean)
      : [];

    await connectDB();
    const created = await Character.create({ projectId, ownerId: userId, ...rest, aliases: aliasList });

    revalidatePath(`/projects/${projectId}/characters`);
    redirect(`/projects/${projectId}/characters/${created._id}`);
  },
  () => ({ error: GENERIC_ERROR }),
  { ids: [0] }
);
