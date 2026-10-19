"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { Chapter } from "@/lib/models/chapter";
import { ChapterVersion } from "@/lib/models/chapter-version";
import { Comment } from "@/lib/models/comment";
import { ownsActiveProject, requireProject, requireUserId } from "@/lib/projects";
import { sectionLabelSingular } from "@/lib/project-config";
import { nextDefaultName } from "@/lib/default-name";
import { countWords } from "@/lib/word-count";
import { getLimit, keepWithinLimit } from "@/lib/entitlements";
import { safeAction } from "@/lib/safe-action";
import { limitMessage } from "@/lib/plans";
import { CHAPTER_LABELS } from "@/lib/chapter-config";

export type CreateChapterResult =
  | { ok: true; id: string; version: number }
  | { ok: false; code: "too_large" | "invalid" | "limit" | "error" };

// Same limit as saving (see MAX_CHAPTER_BYTES in [chapterId]/actions.ts).
const MAX_NEW_CHAPTER_BYTES = 3 * 1024 * 1024;

/**
 * Creates a chapter from the draft editor, on the person's FIRST change.
 * Opening "New chapter" creates nothing; this runs only once there is
 * something to keep, so browsing around never leaves empty chapters behind.
 */
export const createChapterFromDraftAction = safeAction(
  "createChapterFromDraftAction",
  async (
    projectId: string,
    input: { title?: string; content?: unknown }
  ): Promise<CreateChapterResult> => {
    const project = await requireProject(projectId);
    const userId = await requireUserId();

    let json: string;
    let content: unknown;
    try {
      json = JSON.stringify(input.content ?? { type: "doc", content: [] });
      if (Buffer.byteLength(json) > MAX_NEW_CHAPTER_BYTES) return { ok: false, code: "too_large" };
      content = JSON.parse(json);
    } catch {
      return { ok: false, code: "invalid" };
    }

    await connectDB();
    const existing = await Chapter.find({ projectId, ownerId: userId, deletedAt: null })
      .select("title order")
      .lean<{ title: string; order: number }[]>();
    const { limit } = await getLimit(userId, "chapters");
    if (existing.length >= limit) return { ok: false, code: "limit" };
    const label = sectionLabelSingular("chapters", project.type);

    // Next position after the current last one (not "how many exist", which
    // collides after a delete), and a default title nobody is already using.
    const order = existing.reduce((max, c) => Math.max(max, c.order), -1) + 1;
    const typed = typeof input.title === "string" ? input.title.trim().slice(0, 200) : "";
    const title =
      typed ||
      nextDefaultName(
        existing.map((c) => c.title),
        label
      );

    const chapter = await Chapter.create({
      projectId,
      ownerId: userId,
      title,
      order,
      content,
      wordCount: countWords(content),
      contentHash: createHash("sha256").update(json).digest("hex"),
    });
    // Another create may have landed at the same moment (see keepWithinLimit).
    if (!(await keepWithinLimit(Chapter, { projectId, ownerId: userId, deletedAt: null }, chapter._id, limit))) {
      return { ok: false, code: "limit" };
    }

    revalidatePath(`/projects/${projectId}/chapters`);
    return { ok: true, id: String(chapter._id), version: chapter.version ?? 0 };
  },
  () => ({ ok: false as const, code: "error" as const }),
  { ids: [0] }
);

function revalidateChapters(projectId: string) {
  // The list, the sidebar search and the Read view all show chapter order/titles.
  revalidatePath(`/projects/${projectId}`, "layout");
  revalidatePath(`/read/${projectId}`, "layout");
}

/**
 * Saves a new reading order. `orderedIds` must be exactly the project's
 * current chapters, each once; anything else (a chapter added or trashed in
 * another tab since the list loaded) is refused, so the page reloads the
 * real list instead of writing a stale order.
 */
export const reorderChaptersAction = safeAction(
  "reorderChaptersAction",
  async (projectId: string, orderedIds: string[]): Promise<{ ok: boolean }> => {
    const userId = await requireUserId();
    if (!Array.isArray(orderedIds) || !(await ownsActiveProject(userId, projectId))) return { ok: false };

    const current = await Chapter.find({ projectId, ownerId: userId, deletedAt: null })
      .select("_id")
      .lean<{ _id: unknown }[]>();
    const known = new Set(current.map((c) => String(c._id)));
    const unique = new Set(orderedIds);
    if (unique.size !== orderedIds.length || unique.size !== known.size || orderedIds.some((id) => !known.has(id))) {
      return { ok: false };
    }

    // timestamps: false — reordering isn't writing, so it shouldn't move a
    // chapter to the top of the dashboard's "Last worked on".
    await Chapter.bulkWrite(
      orderedIds.map((id, order) => ({
        updateOne: { filter: { _id: id, projectId, ownerId: userId }, update: { $set: { order } } },
      })),
      { timestamps: false }
    );
    revalidateChapters(projectId);
    return { ok: true };
  },
  () => ({ ok: false }),
  { ids: [0] }
);

const metaSchema = z.object({
  status: z.enum(["draft", "in-progress", "done"]).optional(),
  synopsis: z.string().trim().max(1000).optional(),
  label: z.enum(CHAPTER_LABELS).optional(),
});

export type ChapterMetaInput = z.infer<typeof metaSchema>;

/** Status, synopsis and colour label: the outline-board details. */
export const updateChapterMetaAction = safeAction(
  "updateChapterMetaAction",
  async (projectId: string, chapterId: string, input: ChapterMetaInput): Promise<{ ok: boolean }> => {
    const userId = await requireUserId();
    const parsed = metaSchema.safeParse(input);
    if (!parsed.success || !(await ownsActiveProject(userId, projectId))) return { ok: false };
    const result = await Chapter.updateOne(
      { _id: chapterId, projectId, ownerId: userId, deletedAt: null },
      { $set: parsed.data },
      { timestamps: false }
    );
    revalidateChapters(projectId);
    return { ok: result.matchedCount > 0 };
  },
  () => ({ ok: false }),
  { ids: [0, 1] }
);

/** Moves a chapter to the Trash. Nothing is deleted; it can be restored for 30 days. */
export const trashChapterAction = safeAction(
  "trashChapterAction",
  async (projectId: string, chapterId: string): Promise<{ ok: boolean }> => {
    const userId = await requireUserId();
    if (!(await ownsActiveProject(userId, projectId))) return { ok: false };
    const result = await Chapter.updateOne(
      { _id: chapterId, projectId, ownerId: userId, deletedAt: null },
      { $set: { deletedAt: new Date() } },
      { timestamps: false }
    );
    revalidateChapters(projectId);
    return { ok: result.matchedCount > 0 };
  },
  () => ({ ok: false }),
  { ids: [0, 1] }
);

/** Brings a chapter back from the Trash, at the end of the book. Counts as creating one. */
export const restoreChapterAction = safeAction(
  "restoreChapterAction",
  async (projectId: string, chapterId: string): Promise<{ ok: true } | { ok: false; error: string }> => {
    const userId = await requireUserId();
    if (!(await ownsActiveProject(userId, projectId))) return { ok: false, error: "Couldn't find this project." };

    const active = { projectId, ownerId: userId, deletedAt: null };
    const { plan, limit } = await getLimit(userId, "chapters");
    const limited = { ok: false as const, error: limitMessage("chapters", plan) };
    if ((await Chapter.countDocuments(active)) >= limit) return limited;

    const last = await Chapter.findOne(active).sort({ order: -1 }).select("order").lean<{ order: number }>();
    const previous = await Chapter.findOneAndUpdate(
      { _id: chapterId, projectId, ownerId: userId, deletedAt: { $ne: null } },
      { $unset: { deletedAt: "" }, $set: { order: (last?.order ?? -1) + 1 } },
      { timestamps: false, new: false, projection: "deletedAt" }
    ).lean<{ deletedAt: Date }>();
    if (!previous) return { ok: false, error: "Couldn't find this chapter in the Trash." };
    // A create or restore at the same moment may have filled the last slot.
    if ((await Chapter.countDocuments(active)) > limit) {
      await Chapter.updateOne(
        { _id: chapterId, projectId, ownerId: userId },
        { $set: { deletedAt: previous.deletedAt } },
        { timestamps: false }
      );
      return limited;
    }
    revalidateChapters(projectId);
    return { ok: true };
  },
  () => ({ ok: false as const, error: "Couldn't restore it just now. Please try again." }),
  { ids: [0, 1] }
);

/** Permanently deletes a chapter that is already in the Trash, with its versions and comments. */
export const deleteChapterForeverAction = safeAction(
  "deleteChapterForeverAction",
  async (projectId: string, chapterId: string): Promise<{ ok: boolean }> => {
    const userId = await requireUserId();
    if (!(await ownsActiveProject(userId, projectId))) return { ok: false };
    const trashed = await Chapter.exists({ _id: chapterId, projectId, ownerId: userId, deletedAt: { $ne: null } });
    if (!trashed) return { ok: false };
    await purgeChapter(projectId, chapterId, userId);
    revalidateChapters(projectId);
    return { ok: true };
  },
  () => ({ ok: false }),
  { ids: [0, 1] }
);

// Children first, then the chapter: if this stops halfway, the chapter is
// still in the Trash and deleting it again finishes the job.
async function purgeChapter(projectId: string, chapterId: string, userId: string) {
  await Promise.all([
    ChapterVersion.deleteMany({ chapterId, projectId, ownerId: userId }),
    Comment.deleteMany({ chapterId, projectId, ownerId: userId }),
  ]);
  await Chapter.deleteOne({ _id: chapterId, projectId, ownerId: userId });
}
