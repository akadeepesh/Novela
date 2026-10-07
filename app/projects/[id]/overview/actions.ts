"use server";

import { z } from "zod";
import { formString } from "@/lib/form";
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
import { CHAPTER_NUMBERING_STYLE_IDS } from "@/lib/chapter-numbering";
import { TRIM_SIZE_IDS } from "@/lib/export-config";
import { safeAction, GENERIC_ERROR } from "@/lib/safe-action";

const schema = z.object({
  title: z.string().trim().min(1, "Give your project a title").max(200),
  authorName: z.string().trim().max(120).optional(),
});

export type UpdateOverviewState = {
  error?: string;
  success?: boolean;
};

export const updateOverviewAction = safeAction(
  "updateOverviewAction",
  async (
    projectId: string,
    _prevState: UpdateOverviewState,
    formData: FormData
  ): Promise<UpdateOverviewState> => {
    const userId = await requireUserId();

    const parsed = schema.safeParse({
      title: formData.get("title"),
      authorName: formString(formData, "authorName"),
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
  },
  () => ({ error: GENERIC_ERROR }),
  { ids: [0] }
);

export type CoverSide = "front" | "back";
export type UploadCoverState = { error?: string; url?: string };

/** Uploads a front or back cover image, replacing (and cleaning up) any previous one. */
export const uploadCoverAction = safeAction(
  "uploadCoverAction",
  async (
    projectId: string,
    side: CoverSide,
    _prevState: UploadCoverState,
    formData: FormData
  ): Promise<UploadCoverState> => {
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
  },
  () => ({ error: GENERIC_ERROR }),
  { ids: [0] }
);

/** Clears a cover slot — Read View and export fall back to the generated typographic cover. */
export const removeCoverAction = safeAction(
  "removeCoverAction",
  async (projectId: string, side: CoverSide): Promise<{ ok: boolean }> => {
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
  },
  () => ({ ok: false }),
  { ids: [0] }
);

const structureSchema = z.object({
  chapterNumberingStyle: z.enum(CHAPTER_NUMBERING_STYLE_IDS as [string, ...string[]]).optional(),
  chapterNumberingPrefix: z.string().trim().max(40).optional(),
  exportTrimSize: z.enum(TRIM_SIZE_IDS as [string, ...string[]]).optional(),
});
export type StructureInput = z.infer<typeof structureSchema>;

/** Chapter numbering style + export trim size (Part 4.2) — both simple, instantly-saved project-level defaults. */
export const updateStructureSettingsAction = safeAction(
  "updateStructureSettingsAction",
  async (projectId: string, input: StructureInput): Promise<{ ok: boolean }> => {
    const userId = await requireUserId();
    const parsed = structureSchema.safeParse(input);
    if (!parsed.success) return { ok: false };

    await connectDB();
    const result = await Project.updateOne(
      { _id: projectId, ownerId: userId },
      { $set: parsed.data }
    );

    revalidatePath(`/projects/${projectId}/overview`);
    revalidatePath(`/projects/${projectId}/export`);
    revalidatePath(`/projects/${projectId}/chapters`);

    return { ok: result.matchedCount > 0 };
  },
  () => ({ ok: false }),
  { ids: [0] }
);

const blurbSchema = z.object({
  blurb: z.string().trim().max(600).optional(),
});
export type UpdateBackCoverBlurbState = { error?: string; success?: boolean };

/**
 * The back-cover blurb (Part 4.2) — reuses the pre-existing `blurb` field
 * (see the model comment for why), edited only here, never shown anywhere
 * in the app as an empty box when unset.
 */
export const updateBackCoverBlurbAction = safeAction(
  "updateBackCoverBlurbAction",
  async (
    projectId: string,
    _prevState: UpdateBackCoverBlurbState,
    formData: FormData
  ): Promise<UpdateBackCoverBlurbState> => {
    const userId = await requireUserId();
    const parsed = blurbSchema.safeParse({ blurb: formData.get("blurb") ?? undefined });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Check the field and try again." };
    }

    await connectDB();
    const result = await Project.updateOne(
      { _id: projectId, ownerId: userId },
      { $set: { blurb: parsed.data.blurb ?? "" } }
    );
    if (result.matchedCount === 0) return { error: "Couldn't find this project." };

    revalidatePath(`/projects/${projectId}/overview`);
    revalidatePath(`/projects/${projectId}/export`);
    return { success: true };
  },
  () => ({ error: GENERIC_ERROR }),
  { ids: [0] }
);

export type DeleteProjectState = {
  error?: string;
};

export const deleteProjectAction = safeAction(
  "deleteProjectAction",
  async (projectId: string): Promise<DeleteProjectState> => {
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
  },
  () => ({ error: GENERIC_ERROR }),
  { ids: [0] }
);
