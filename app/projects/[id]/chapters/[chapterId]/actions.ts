"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import { Chapter } from "@/lib/models/chapter";
import { Project } from "@/lib/models/project";
import { requireUserId } from "@/lib/projects";
import { BACKGROUND_IDS, CUSTOM_BACKGROUND_ID, LINE_WIDTHS } from "@/lib/manuscript-config";
import { uploadProjectImage, deleteProjectImage } from "@/lib/blob";
import { maybeCreateAutoSnapshot, createManualSnapshot, restoreVersion, listVersionsForChapter, requireVersionContent } from "@/lib/versions";
import { tiptapToBlocks, runsText } from "@/lib/export/document-model";
import { diffWords } from "@/lib/text-diff";

const saveSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  content: z.unknown().optional(),
  wordCount: z.number().int().min(0).max(5_000_000).optional(),
});

export type SaveChapterInput = z.infer<typeof saveSchema>;

export async function saveChapterAction(
  projectId: string,
  chapterId: string,
  input: SaveChapterInput
): Promise<{ ok: boolean }> {
  const userId = await requireUserId();
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return { ok: false };

  // Rebuilt as a fresh plain object rather than passed straight through:
  // this is the exact value the Mongo driver's BSON layer will walk to
  // build the write command, so it's worth being explicit about what's in
  // it rather than trusting the reference all the way from the client.
  const update: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) update.title = parsed.data.title;
  if (parsed.data.wordCount !== undefined) update.wordCount = parsed.data.wordCount;
  if (parsed.data.content !== undefined) {
    try {
      // A plain JSON round-trip guarantees only JSON-safe data reaches
      // Mongo — anything that isn't (a class instance, a stray function,
      // anything non-plain) fails here, loudly and by itself, instead of
      // surfacing as a confusing crash from inside the database driver.
      update.content = JSON.parse(JSON.stringify(parsed.data.content));
    } catch {
      return { ok: false };
    }
  }

  await connectDB();
  let result: { matchedCount: number };
  try {
    result = await Chapter.updateOne(
      { _id: chapterId, projectId, ownerId: userId },
      { $set: update }
    );
  } catch (err) {
    console.error("saveChapterAction: Chapter.updateOne failed", err);
    return { ok: false };
  }

  // Version snapshots only matter for actual content changes — a
  // title-only save shouldn't churn it.
  if (result.matchedCount > 0 && "content" in update) {
    const chapter = await Chapter.findOne({ _id: chapterId, projectId, ownerId: userId }).lean<{
      title: string;
      content: unknown;
      wordCount: number;
    }>();
    if (chapter) {
      await maybeCreateAutoSnapshot({
        userId,
        projectId,
        chapterId,
        title: chapter.title,
        content: chapter.content,
        wordCount: chapter.wordCount ?? 0,
      });
    }
  }

  return { ok: result.matchedCount > 0 };
}

export async function createVersionAction(
  projectId: string,
  chapterId: string,
  label?: string
): Promise<{ ok: boolean }> {
  return createManualSnapshot(projectId, chapterId, label);
}

export async function restoreVersionAction(
  projectId: string,
  chapterId: string,
  versionId: string
): Promise<{ ok: boolean }> {
  const result = await restoreVersion(projectId, chapterId, versionId);
  if (result.ok) {
    revalidatePath(`/projects/${projectId}/chapters/${chapterId}`);
  }
  return result;
}

export async function listVersionsAction(projectId: string, chapterId: string) {
  return listVersionsForChapter(projectId, chapterId);
}

export async function getVersionDiffAction(
  projectId: string,
  chapterId: string,
  versionId: string,
  currentContent: unknown
) {
  const version = await requireVersionContent(projectId, chapterId, versionId);
  const oldText = runsText(tiptapToBlocks(version.content).flatMap((b) => b.runs));
  const newText = runsText(tiptapToBlocks(currentContent).flatMap((b) => b.runs));
  return {
    title: version.title,
    wordCount: version.wordCount,
    diff: diffWords(oldText, newText),
  };
}

const statusSchema = z.enum(["draft", "in-progress", "done"]);

export async function setChapterStatusAction(
  projectId: string,
  chapterId: string,
  status: string
) {
  const userId = await requireUserId();
  const parsed = statusSchema.safeParse(status);
  if (!parsed.success) return;

  await connectDB();
  await Chapter.updateOne(
    { _id: chapterId, projectId, ownerId: userId },
    { $set: { status: parsed.data } }
  );
  revalidatePath(`/projects/${projectId}/chapters`);
}

const manuscriptSettingsSchema = z.object({
  background: z.enum(BACKGROUND_IDS as [string, ...string[]]).optional(),
  showHeader: z.boolean().optional(),
  headerText: z.string().trim().max(120).optional(),
  showFooter: z.boolean().optional(),
  footerText: z.string().trim().max(120).optional(),
  fontSize: z.number().min(14).max(28).optional(),
  lineHeight: z.number().min(1.3).max(2.2).optional(),
  lineWidth: z.enum(LINE_WIDTHS).optional(),
});

export type ManuscriptSettingsInput = z.infer<typeof manuscriptSettingsSchema>;

export async function updateManuscriptSettingsAction(
  projectId: string,
  input: ManuscriptSettingsInput
): Promise<{ ok: boolean }> {
  const userId = await requireUserId();
  const parsed = manuscriptSettingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false };

  await connectDB();
  const set: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(parsed.data)) {
    set[`manuscriptSettings.${key}`] = value;
  }

  const result = await Project.updateOne({ _id: projectId, ownerId: userId }, { $set: set });

  // ManuscriptSettingsCard (Book Settings) drives its swatches/inputs with
  // useOptimistic on top of the `settings` prop from this page's server
  // component. Once its transition resolves, React drops the pending
  // optimistic value and falls back to that prop — without revalidating
  // it here, the prop is still the pre-update value, so the UI visibly
  // snaps back to the old setting for a moment even though the DB write
  // above already succeeded.
  revalidatePath(`/projects/${projectId}/overview`);
  revalidatePath(`/projects/${projectId}/chapters`);

  return { ok: result.matchedCount > 0 };
}

export type UploadBackgroundState = { error?: string; url?: string };

/**
 * Uploads a custom manuscript background image and switches the project
 * over to it in one step — the "custom" swatch only ever appears once an
 * image exists, so selecting it and uploading are the same action.
 */
export async function uploadManuscriptBackgroundAction(
  projectId: string,
  _prevState: UploadBackgroundState,
  formData: FormData
): Promise<UploadBackgroundState> {
  const userId = await requireUserId();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose an image first." };
  }

  const result = await uploadProjectImage({ projectId, kind: "background", file });
  if (!result.ok) return { error: result.error };

  await connectDB();
  const existing = await Project.findOne({ _id: projectId, ownerId: userId }).lean<{
    manuscriptSettings?: { backgroundImageUrl?: string };
  }>();
  if (!existing) return { error: "Couldn't find this project." };

  await Project.updateOne(
    { _id: projectId, ownerId: userId },
    {
      $set: {
        "manuscriptSettings.backgroundImageUrl": result.url,
        "manuscriptSettings.background": CUSTOM_BACKGROUND_ID,
        "manuscriptSettings.backgroundVeil": true,
      },
    }
  );
  // Fire-and-forget-ish: only after the new URL is safely saved do we
  // remove the old blob, so a mid-upload failure never leaves the project
  // pointing at a deleted image.
  await deleteProjectImage(existing.manuscriptSettings?.backgroundImageUrl);

  revalidatePath(`/projects/${projectId}/overview`);
  revalidatePath(`/projects/${projectId}/chapters`);
  return { url: result.url };
}

/** Clears the custom background and drops back to the "paper" preset. */
export async function removeManuscriptBackgroundAction(
  projectId: string
): Promise<{ ok: boolean }> {
  const userId = await requireUserId();
  await connectDB();

  const existing = await Project.findOne({ _id: projectId, ownerId: userId }).lean<{
    manuscriptSettings?: { backgroundImageUrl?: string };
  }>();
  if (!existing) return { ok: false };

  await Project.updateOne(
    { _id: projectId, ownerId: userId },
    {
      $set: {
        "manuscriptSettings.backgroundImageUrl": "",
        "manuscriptSettings.background": "paper",
      },
    }
  );
  await deleteProjectImage(existing.manuscriptSettings?.backgroundImageUrl);

  revalidatePath(`/projects/${projectId}/overview`);
  revalidatePath(`/projects/${projectId}/chapters`);
  return { ok: true };
}
