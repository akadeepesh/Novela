"use server";

import { z } from "zod";
import { formString } from "@/lib/form";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import { ResearchEntry } from "@/lib/models/research-entry";
import { ownsActiveProject, TRASHED_PROJECT_ERROR, requireUserId } from "@/lib/projects";
import { RESEARCH_ENTRY_TYPES, type ResearchEntryType } from "@/lib/research-config";
import { safeAction, GENERIC_ERROR } from "@/lib/safe-action";

const TYPE_VALUES = RESEARCH_ENTRY_TYPES.map((t) => t.value) as [
  ResearchEntryType,
  ...ResearchEntryType[],
];

const schema = z.object({
  title: z.string().trim().min(1, "Give this entry a title").max(160),
  type: z.enum(TYPE_VALUES),
  // Only web links: anything else (javascript:, data:) must never become a clickable href.
  url: z
    .string()
    .trim()
    .max(2000)
    .refine((v) => v === "" || /^https?:\/\//i.test(v), "Links must start with http:// or https://")
    .optional(),
  content: z.string().trim().max(8000).optional(),
});

export type UpdateResearchEntryState = {
  error?: string;
  success?: boolean;
};

export const updateResearchEntryAction = safeAction(
  "updateResearchEntryAction",
  async (
    projectId: string,
    entryId: string,
    _prevState: UpdateResearchEntryState,
    formData: FormData
  ): Promise<UpdateResearchEntryState> => {
    const userId = await requireUserId();

    const parsed = schema.safeParse({
      title: formData.get("title"),
      type: formData.get("type"),
      url: formString(formData, "url"),
      content: formString(formData, "content"),
    });

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Check the fields and try again." };
    }

    if (!(await ownsActiveProject(userId, projectId))) return { error: TRASHED_PROJECT_ERROR };

    await connectDB();
    const result = await ResearchEntry.updateOne(
      { _id: entryId, projectId, ownerId: userId },
      { $set: parsed.data }
    );

    if (result.matchedCount === 0) {
      return { error: "Couldn't find this entry." };
    }

    revalidatePath(`/projects/${projectId}/research`);
    revalidatePath(`/projects/${projectId}/research/${entryId}`);
    return { success: true };
  },
  () => ({ error: GENERIC_ERROR }),
  { ids: [0, 1] }
);
