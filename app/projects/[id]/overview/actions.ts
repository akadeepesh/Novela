"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import { Project } from "@/lib/models/project";
import { requireUserId } from "@/lib/projects";

const schema = z.object({
  title: z.string().trim().min(1, "Give your project a title").max(200),
  genre: z.string().trim().max(60).optional(),
  blurb: z.string().trim().max(2000).optional(),
  authorName: z.string().trim().max(120).optional(),
  targetWordCount: z.coerce.number().min(0).max(10_000_000).optional(),
  dailyWordGoal: z.coerce.number().min(0).max(100_000).optional(),
});

export type UpdateOverviewState = {
  error?: string;
  success?: boolean;
};

export async function updateOverviewAction(
  projectId: string,
  _prevState: UpdateOverviewState,
  formData: FormData
): Promise<UpdateOverviewState> {
  const userId = await requireUserId();

  const rawWordCount = formData.get("targetWordCount");
  const rawDailyGoal = formData.get("dailyWordGoal");
  const parsed = schema.safeParse({
    title: formData.get("title"),
    genre: (formData.get("genre") as string) || undefined,
    blurb: (formData.get("blurb") as string) || undefined,
    authorName: (formData.get("authorName") as string) || undefined,
    targetWordCount: rawWordCount ? rawWordCount : undefined,
    dailyWordGoal: rawDailyGoal ? rawDailyGoal : undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the fields and try again." };
  }

  await connectDB();
  const result = await Project.updateOne(
    { _id: projectId, ownerId: userId },
    { $set: parsed.data }
  );

  if (result.matchedCount === 0) {
    return { error: "Couldn't find this project." };
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/dashboard");
  return { success: true };
}
