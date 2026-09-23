"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import { Project } from "@/lib/models/project";
import { Chapter } from "@/lib/models/chapter";
import { ChapterVersion } from "@/lib/models/chapter-version";
import { Character } from "@/lib/models/character";
import { WorldEntry } from "@/lib/models/world-entry";
import { PlotThread } from "@/lib/models/plot-thread";
import { Note } from "@/lib/models/note";
import { ResearchEntry } from "@/lib/models/research-entry";
import { DailyStat } from "@/lib/models/daily-stat";
import { requireUserId } from "@/lib/projects";
import { uploadProjectImage, deleteProjectImage } from "@/lib/blob";

const schema = z.object({
  title: z.string().trim().min(1, "Give your project a title").max(200),
  authorName: z.string().trim().max(120).optional(),
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

  const parsed = schema.safeParse({
    title: formData.get("title"),
    authorName: (formData.get("authorName") as string) || undefined,
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

export type CoverSide = "front" | "back";
export type UploadCoverState = { error?: string; url?: string };

/** Uploads a front or back cover image, replacing (and cleaning up) any previous one. */
export async function uploadCoverAction(
  projectId: string,
  side: CoverSide,
  _prevState: UploadCoverState,
  formData: FormData
): Promise<UploadCoverState> {
  const userId = await requireUserId();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose an image first." };
  }

  const result = await uploadProjectImage({
    projectId,
    kind: side === "front" ? "cover-front" : "cover-back",
    file,
  });
  if (!result.ok) return { error: result.error };

  const field = side === "front" ? "coverFrontUrl" : "coverBackUrl";
  await connectDB();
  const existing = await Project.findOne({ _id: projectId, ownerId: userId }).lean<
    Record<string, string | undefined>
  >();
  if (!existing) return { error: "Couldn't find this project." };

  await Project.updateOne({ _id: projectId, ownerId: userId }, { $set: { [field]: result.url } });
  await deleteProjectImage(existing[field]);

  revalidatePath(`/projects/${projectId}/overview`);
  return { url: result.url };
}

/** Clears a cover slot — Read View and export fall back to the generated typographic cover. */
export async function removeCoverAction(
  projectId: string,
  side: CoverSide
): Promise<{ ok: boolean }> {
  const userId = await requireUserId();
  const field = side === "front" ? "coverFrontUrl" : "coverBackUrl";

  await connectDB();
  const existing = await Project.findOne({ _id: projectId, ownerId: userId }).lean<
    Record<string, string | undefined>
  >();
  if (!existing) return { ok: false };

  await Project.updateOne({ _id: projectId, ownerId: userId }, { $set: { [field]: "" } });
  await deleteProjectImage(existing[field]);

  revalidatePath(`/projects/${projectId}/overview`);
  return { ok: true };
}

export type DeleteProjectState = {
  error?: string;
};

export async function deleteProjectAction(
  projectId: string
): Promise<DeleteProjectState> {
  const userId = await requireUserId();
  await connectDB();

  // findOneAndDelete both confirms ownership and removes the project in
  // one step — if it doesn't match, either the id is wrong or it isn't
  // this user's project, and either way there's nothing to cascade.
  const deleted = await Project.findOneAndDelete({ _id: projectId, ownerId: userId });
  if (!deleted) {
    return { error: "Couldn't find this project." };
  }

  // Every other collection is scoped by both projectId and ownerId, same
  // as everywhere else in the app — a project can only ever cascade its
  // own owner's data.
  await Promise.all([
    Chapter.deleteMany({ projectId, ownerId: userId }),
    ChapterVersion.deleteMany({ projectId, ownerId: userId }),
    Character.deleteMany({ projectId, ownerId: userId }),
    WorldEntry.deleteMany({ projectId, ownerId: userId }),
    PlotThread.deleteMany({ projectId, ownerId: userId }),
    Note.deleteMany({ projectId, ownerId: userId }),
    ResearchEntry.deleteMany({ projectId, ownerId: userId }),
    DailyStat.deleteMany({ projectId, ownerId: userId }),
    deleteProjectImage(deleted.coverFrontUrl as string | undefined),
    deleteProjectImage(deleted.coverBackUrl as string | undefined),
    deleteProjectImage(
      (deleted.manuscriptSettings as { backgroundImageUrl?: string } | undefined)
        ?.backgroundImageUrl
    ),
  ]);

  revalidatePath("/dashboard");
  redirect("/dashboard");
}
