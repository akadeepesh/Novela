"use server";

import { createHash } from "node:crypto";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import { Chapter } from "@/lib/models/chapter";
import { Project } from "@/lib/models/project";
import { requireUserId } from "@/lib/projects";
import { BACKGROUND_IDS, CUSTOM_BACKGROUND_ID, LINE_WIDTHS } from "@/lib/manuscript-config";
import { uploadProjectImage, deleteProjectImage } from "@/lib/blob";
import {
  snapshotBeforeSave,
  createManualSnapshot,
  restoreVersion,
  listVersionsForChapter,
  requireVersionContent,
} from "@/lib/versions";
import { tiptapToBlocks, runsText } from "@/lib/export/document-model";
import { diffWords } from "@/lib/text-diff";
import { countWords } from "@/lib/word-count";
import { safeAction, GENERIC_ERROR } from "@/lib/safe-action";

// Largest chapter we accept, as serialised JSON. Keep below the Server Action
// body limit in next.config.ts.
const MAX_CHAPTER_BYTES = 3 * 1024 * 1024;

const saveSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  content: z.unknown().optional(),
  // The chapter version this edit was made on top of (see Chapter.version).
  baseVersion: z.number().int().min(0).optional(),
  // "Keep mine" after a conflict: save regardless of the version.
  force: z.boolean().optional(),
});

export type SaveChapterInput = z.infer<typeof saveSchema>;

export type SaveChapterResult =
  | { ok: true; version: number; wordCount?: number }
  | { ok: false; code: "conflict" | "too_large" | "invalid" | "not_found" | "limit" | "error" };

export const saveChapterAction = safeAction(
  "saveChapterAction",
  async (
    projectId: string,
    chapterId: string,
    input: SaveChapterInput
  ): Promise<SaveChapterResult> => {
    const userId = await requireUserId();
    const parsed = saveSchema.safeParse(input);
    if (!parsed.success) return { ok: false, code: "invalid" };

    // Rebuilt as a fresh plain object rather than passed straight through:
    // this is the exact value the Mongo driver's BSON layer will walk to
    // build the write command, so it's worth being explicit about what's in
    // it rather than trusting the reference all the way from the client.
    const update: Record<string, unknown> = {};
    if (parsed.data.title !== undefined) update.title = parsed.data.title;
    let newHash: string | undefined;
    let newWordCount: number | undefined;
    if (parsed.data.content !== undefined) {
      let json: string;
      try {
        // A plain JSON round-trip guarantees only JSON-safe data reaches
        // Mongo — anything that isn't (a class instance, a stray function,
        // anything non-plain) fails here, loudly and by itself, instead of
        // surfacing as a confusing crash from inside the database driver.
        // The same string is hashed, so the content is only serialised once.
        json = JSON.stringify(parsed.data.content);
        if (Buffer.byteLength(json) > MAX_CHAPTER_BYTES) return { ok: false, code: "too_large" };
        update.content = JSON.parse(json);
      } catch {
        return { ok: false, code: "invalid" };
      }
      newHash = createHash("sha256").update(json).digest("hex");
      update.contentHash = newHash;
      // The server decides the word count; a client-supplied number is never trusted.
      newWordCount = countWords(update.content);
      update.wordCount = newWordCount;
    }

    await connectDB();
    // Returns the chapter as it was BEFORE this update, so the version history
    // can keep the text that is about to be replaced (see snapshotBeforeSave).
    type PreviousChapter = {
      title: string;
      content: unknown;
      wordCount?: number;
      contentHash?: string;
      lastSnapshotAt?: Date;
      version?: number;
    };

    // Only apply the save if nobody else has saved since the version this edit
    // was based on. `version: null` also matches chapters from before the field existed.
    const filter: Record<string, unknown> = { _id: chapterId, projectId, ownerId: userId };
    if (!parsed.data.force && parsed.data.baseVersion !== undefined) {
      filter.version = parsed.data.baseVersion === 0 ? { $in: [0, null] } : parsed.data.baseVersion;
    }

    let previous: PreviousChapter | null;
    try {
      previous = await Chapter.findOneAndUpdate(
        filter,
        { $set: update, $inc: { version: 1 } },
        { new: false, projection: "title content wordCount contentHash lastSnapshotAt version" }
      ).lean<PreviousChapter>();
    } catch (err) {
      console.error("saveChapterAction: Chapter.findOneAndUpdate failed", err);
      return { ok: false, code: "error" };
    }
    if (!previous) {
      // Either the chapter is gone, or its version moved on since this edit started.
      const exists = await Chapter.exists({ _id: chapterId, projectId, ownerId: userId });
      return { ok: false, code: exists ? "conflict" : "not_found" };
    }

    // Title-only saves don't touch history. A snapshot failing must never turn
    // a successful save into an error, so it is isolated here.
    if (newHash !== undefined) {
      try {
        await snapshotBeforeSave({
          userId,
          projectId,
          chapterId,
          previous,
          newHash,
          newWordCount,
        });
      } catch (err) {
        console.error("saveChapterAction: snapshotBeforeSave failed", err);
      }
    }

    return { ok: true, version: (previous.version ?? 0) + 1, wordCount: newWordCount };
  },
  () => ({ ok: false as const, code: "error" as const }),
  { ids: [0, 1] }
);

export const createVersionAction = safeAction(
  "createVersionAction",
  async (projectId: string, chapterId: string, label?: string): Promise<{ ok: boolean }> => {
    return createManualSnapshot(projectId, chapterId, label);
  },
  () => ({ ok: false }),
  { ids: [0, 1] }
);

export const restoreVersionAction = safeAction(
  "restoreVersionAction",
  async (projectId: string, chapterId: string, versionId: string): Promise<{ ok: boolean }> => {
    const result = await restoreVersion(projectId, chapterId, versionId);
    if (result.ok) {
      revalidatePath(`/projects/${projectId}/chapters/${chapterId}`);
    }
    return result;
  },
  () => ({ ok: false }),
  { ids: [0, 1, 2] }
);

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

export const setChapterStatusAction = safeAction(
  "setChapterStatusAction",
  async (projectId: string, chapterId: string, status: string) => {
    const userId = await requireUserId();
    const parsed = statusSchema.safeParse(status);
    if (!parsed.success) return;

    await connectDB();
    await Chapter.updateOne(
      { _id: chapterId, projectId, ownerId: userId },
      { $set: { status: parsed.data } }
    );
    revalidatePath(`/projects/${projectId}/chapters`);
  },
  () => undefined,
  { ids: [0, 1] }
);

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

export const updateManuscriptSettingsAction = safeAction(
  "updateManuscriptSettingsAction",
  async (projectId: string, input: ManuscriptSettingsInput): Promise<{ ok: boolean }> => {
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
  },
  () => ({ ok: false }),
  { ids: [0] }
);

export type UploadBackgroundState = { error?: string; url?: string };

/**
 * Uploads a custom manuscript background image and switches the project
 * over to it in one step — the "custom" swatch only ever appears once an
 * image exists, so selecting it and uploading are the same action.
 */
export const uploadManuscriptBackgroundAction = safeAction(
  "uploadManuscriptBackgroundAction",
  async (
    projectId: string,
    _prevState: UploadBackgroundState,
    formData: FormData
  ): Promise<UploadBackgroundState> => {
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
  },
  () => ({ error: GENERIC_ERROR }),
  { ids: [0] }
);

/** Clears the custom background and drops back to the "paper" preset. */
export const removeManuscriptBackgroundAction = safeAction(
  "removeManuscriptBackgroundAction",
  async (projectId: string): Promise<{ ok: boolean }> => {
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
  },
  () => ({ ok: false }),
  { ids: [0] }
);
