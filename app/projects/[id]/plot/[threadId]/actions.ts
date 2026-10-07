"use server";

import { z } from "zod";
import { formString } from "@/lib/form";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import { PlotThread } from "@/lib/models/plot-thread";
import { requireUserId } from "@/lib/projects";
import { PLOT_STATUSES, type PlotStatus } from "@/lib/plot-config";
import { safeAction, GENERIC_ERROR } from "@/lib/safe-action";

const STATUS_VALUES = PLOT_STATUSES.map((s) => s.value) as [PlotStatus, ...PlotStatus[]];

const schema = z.object({
  title: z.string().trim().min(1, "Give this thread a title").max(120),
  status: z.enum(STATUS_VALUES),
  aliases: z.string().trim().max(500).optional(),
  description: z.string().trim().max(4000).optional(),
  notes: z.string().trim().max(4000).optional(),
});

export type UpdatePlotThreadState = {
  error?: string;
  success?: boolean;
};

export const updatePlotThreadAction = safeAction(
  "updatePlotThreadAction",
  async (
    projectId: string,
    threadId: string,
    _prevState: UpdatePlotThreadState,
    formData: FormData
  ): Promise<UpdatePlotThreadState> => {
    const userId = await requireUserId();

    const parsed = schema.safeParse({
      title: formData.get("title"),
      status: formData.get("status"),
      aliases: formString(formData, "aliases"),
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
    const result = await PlotThread.updateOne(
      { _id: threadId, projectId, ownerId: userId },
      { $set: { ...rest, aliases: aliasList } }
    );

    if (result.matchedCount === 0) {
      return { error: "Couldn't find this thread." };
    }

    revalidatePath(`/projects/${projectId}/plot`);
    revalidatePath(`/projects/${projectId}/plot/${threadId}`);
    return { success: true };
  },
  () => ({ error: GENERIC_ERROR }),
  { ids: [0, 1] }
);
