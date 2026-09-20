"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import { Chapter } from "@/lib/models/chapter";
import { Project } from "@/lib/models/project";
import { requireUserId } from "@/lib/projects";
import { BACKGROUND_IDS, LINE_WIDTHS } from "@/lib/manuscript-config";
import { maybeCreateAutoSnapshot, createManualSnapshot, restoreVersion, listVersionsForChapter, requireVersionContent } from "@/lib/versions";
import { recordDailyProgress } from "@/lib/analytics";
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

  await connectDB();
  const result = await Chapter.updateOne(
    { _id: chapterId, projectId, ownerId: userId },
    { $set: parsed.data }
  );

  // Version snapshots and daily progress only matter for actual content
  // changes — a title-only save shouldn't churn either.
  if (result.matchedCount > 0 && "content" in parsed.data) {
    const chapter = await Chapter.findOne({ _id: chapterId, projectId, ownerId: userId }).lean<{
      title: string;
      content: unknown;
      wordCount: number;
    }>();
    if (chapter) {
      await Promise.all([
        maybeCreateAutoSnapshot({
          userId,
          projectId,
          chapterId,
          title: chapter.title,
          content: chapter.content,
          wordCount: chapter.wordCount ?? 0,
        }),
        recordDailyProgress(userId, projectId),
      ]);
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
  return { ok: result.matchedCount > 0 };
}
