"use server";

import { z } from "zod";
import { connectDB } from "@/lib/db";
import { Feedback } from "@/lib/models/feedback";
import { requireUserId } from "@/lib/projects";

const schema = z.object({
  message: z.string().trim().min(1, "Say a little more than that").max(4000),
  page: z.string().trim().max(300).optional(),
});

export async function submitFeedbackAction(input: {
  message: string;
  page?: string;
}): Promise<{ ok: boolean }> {
  const userId = await requireUserId();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false };

  await connectDB();
  await Feedback.create({ ownerId: userId, ...parsed.data });
  return { ok: true };
}
