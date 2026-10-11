"use server";

import { z } from "zod";
import { formString } from "@/lib/form";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import { WorldEntry } from "@/lib/models/world-entry";
import { requireProject, requireUserId } from "@/lib/projects";
import { WORLD_ENTRY_TYPES, type WorldEntryType } from "@/lib/world-config";
import { safeAction, GENERIC_ERROR } from "@/lib/safe-action";
import { LIMITS, limitMessage } from "@/lib/limits";

const TYPE_VALUES = WORLD_ENTRY_TYPES.map((t) => t.value) as [WorldEntryType, ...WorldEntryType[]];

const schema = z.object({
  name: z.string().trim().min(1, "Give this entry a name").max(120),
  type: z.enum(TYPE_VALUES),
  aliases: z.string().trim().max(500).optional(),
  imageUrl: z.string().trim().max(2000).optional(),
  description: z.string().trim().max(4000).optional(),
  notes: z.string().trim().max(4000).optional(),
});

export type UpdateWorldEntryState = {
  error?: string;
  success?: boolean;
};

export const updateWorldEntryAction = safeAction(
  "updateWorldEntryAction",
  async (
    projectId: string,
    entryId: string,
    _prevState: UpdateWorldEntryState,
    formData: FormData
  ): Promise<UpdateWorldEntryState> => {
    const userId = await requireUserId();

    const parsed = schema.safeParse({
      name: formData.get("name"),
      type: formData.get("type"),
      aliases: formString(formData, "aliases"),
      imageUrl: formString(formData, "imageUrl"),
      description: formString(formData, "description"),
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
    const result = await WorldEntry.updateOne(
      { _id: entryId, projectId, ownerId: userId },
      { $set: { ...rest, aliases: aliasList } }
    );

    if (result.matchedCount === 0) {
      return { error: "Couldn't find this entry." };
    }

    revalidatePath(`/projects/${projectId}/world`);
    revalidatePath(`/projects/${projectId}/world/${entryId}`);
    return { success: true };
  },
  () => ({ error: GENERIC_ERROR }),
  { ids: [0, 1] }
);

/**
 * Creates the record from the blank "new" form. Nothing exists in the database
 * until this runs, so opening the form and walking away leaves no stray record.
 */
export const createWorldEntryFromFormAction = safeAction(
  "createWorldEntryFromFormAction",
  async (
    projectId: string,
    _prevState: UpdateWorldEntryState,
    formData: FormData
  ): Promise<UpdateWorldEntryState> => {
    await requireProject(projectId);
    const userId = await requireUserId();

    const parsed = schema.safeParse({
      name: formData.get("name"),
      type: formData.get("type"),
      aliases: formString(formData, "aliases"),
      imageUrl: formString(formData, "imageUrl"),
      description: formString(formData, "description"),
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
    if ((await WorldEntry.countDocuments({ projectId, ownerId: userId })) >= LIMITS.worldEntries) {
      return { error: limitMessage("worldEntries") };
    }
    const created = await WorldEntry.create({ projectId, ownerId: userId, ...rest, aliases: aliasList });

    revalidatePath(`/projects/${projectId}/world`);
    redirect(`/projects/${projectId}/world/${created._id}`);
  },
  () => ({ error: GENERIC_ERROR }),
  { ids: [0] }
);
