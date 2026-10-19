"use server";

import { z } from "zod";
import { formString } from "@/lib/form";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import { Project } from "@/lib/models/project";
import { ownsActiveProject, requireUserId } from "@/lib/projects";
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
      { _id: projectId, ownerId: userId, deletedAt: null },
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

// The cover shows on Book Settings, in the Read view and on the export page.
function revalidateCover(projectId: string) {
  revalidatePath(`/projects/${projectId}/overview`);
  revalidatePath(`/projects/${projectId}/export`);
  revalidatePath(`/read/${projectId}`, "layout");
}
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

    // Ownership first: never store a file for a project that isn't the caller's.
    if (!(await ownsActiveProject(userId, projectId))) return { error: "Couldn't find this project." };

    const result = await uploadProjectImage({
      userId,
      projectId,
      kind: side === "front" ? "cover-front" : "cover-back",
      file,
    });
    if (!result.ok) return { error: result.error };

    const field = side === "front" ? "coverFrontUrl" : "coverBackUrl";
    // Swap in the new URL and read the old one in the same write, so two
    // uploads racing each other can't both "replace" the same old image and
    // leave one new image orphaned.
    const previous = await Project.findOneAndUpdate(
      { _id: projectId, ownerId: userId, deletedAt: null },
      { $set: { [field]: result.url } },
      { new: false, projection: field }
    ).lean<Record<string, string | undefined>>();
    if (!previous) {
      await deleteProjectImage(userId, result.url);
      return { error: "Couldn't find this project." };
    }
    await deleteProjectImage(userId, previous[field]);

    revalidateCover(projectId);
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
    const previous = await Project.findOneAndUpdate(
      { _id: projectId, ownerId: userId, deletedAt: null },
      { $set: { [field]: "" } },
      { new: false, projection: field }
    ).lean<Record<string, string | undefined>>();
    if (!previous) return { ok: false };
    await deleteProjectImage(userId, previous[field]);

    revalidateCover(projectId);
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
      { _id: projectId, ownerId: userId, deletedAt: null },
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
      { _id: projectId, ownerId: userId, deletedAt: null },
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
