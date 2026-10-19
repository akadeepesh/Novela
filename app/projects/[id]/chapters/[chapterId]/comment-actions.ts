"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import { Chapter } from "@/lib/models/chapter";
import { Comment } from "@/lib/models/comment";
import { ownsActiveProject, requireUserId } from "@/lib/projects";
import { safeAction } from "@/lib/safe-action";
import { MAX_QUOTE_LENGTH, serializeComment, type SerializedComment } from "@/lib/comments";

// Plenty for one chapter's margin; stops runaway scripts.
const MAX_COMMENTS_PER_CHAPTER = 500;

/** Every comment on a chapter (the writer's and readers'), oldest first. Marks reader comments as seen. */
export const listChapterCommentsAction = safeAction(
  "listChapterCommentsAction",
  async (
    projectId: string,
    chapterId: string
  ): Promise<{ ok: true; comments: SerializedComment[] } | { ok: false }> => {
    const userId = await requireUserId();
    await connectDB();
    const docs = await Comment.find({ projectId, chapterId, ownerId: userId })
      .sort({ createdAt: 1 })
      .lean<Record<string, unknown>[]>();
    const comments = docs.map(serializeComment);
    if (comments.some((c) => !c.seen)) {
      await Comment.updateMany({ projectId, chapterId, ownerId: userId, seenByOwner: false }, { $set: { seenByOwner: true } });
      revalidatePath("/dashboard");
    }
    return { ok: true, comments };
  },
  () => ({ ok: false as const }),
  { ids: [0, 1] }
);

const createSchema = z.object({
  body: z.string().trim().min(1).max(2000),
  quote: z.string().max(5000),
});

/** The writer's own margin note. The editor then marks the passage with the returned id. */
export const createOwnerCommentAction = safeAction(
  "createOwnerCommentAction",
  async (
    projectId: string,
    chapterId: string,
    input: { body: string; quote: string }
  ): Promise<{ ok: true; comment: SerializedComment } | { ok: false; error: string }> => {
    const userId = await requireUserId();
    const parsed = createSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Write something first (up to 2,000 characters)." };
    if (!(await ownsActiveProject(userId, projectId))) return { ok: false, error: "Couldn't find this project." };
    if (!(await Chapter.exists({ _id: chapterId, projectId, ownerId: userId, deletedAt: null }))) {
      return { ok: false, error: "Couldn't find this chapter." };
    }
    if ((await Comment.countDocuments({ chapterId, ownerId: userId })) >= MAX_COMMENTS_PER_CHAPTER) {
      return { ok: false, error: "This chapter has too many comments. Delete some you've dealt with first." };
    }
    const doc = await Comment.create({
      projectId,
      chapterId,
      ownerId: userId,
      authorKind: "owner",
      body: parsed.data.body,
      quote: parsed.data.quote.trim().slice(0, MAX_QUOTE_LENGTH),
    });
    return { ok: true, comment: serializeComment(doc.toObject()) };
  },
  () => ({ ok: false as const, error: "Couldn't save the comment. Please try again." }),
  { ids: [0, 1] }
);

export const setCommentResolvedAction = safeAction(
  "setCommentResolvedAction",
  async (projectId: string, commentId: string, resolved: boolean): Promise<{ ok: boolean }> => {
    const userId = await requireUserId();
    if (!(await ownsActiveProject(userId, projectId))) return { ok: false };
    const result = await Comment.updateOne(
      { _id: commentId, projectId, ownerId: userId },
      { $set: { resolved: Boolean(resolved) } }
    );
    return { ok: result.matchedCount > 0 };
  },
  () => ({ ok: false }),
  { ids: [0, 1] }
);

export const deleteCommentAction = safeAction(
  "deleteCommentAction",
  async (projectId: string, commentId: string): Promise<{ ok: boolean }> => {
    const userId = await requireUserId();
    if (!(await ownsActiveProject(userId, projectId))) return { ok: false };
    await Comment.deleteOne({ _id: commentId, projectId, ownerId: userId });
    return { ok: true };
  },
  () => ({ ok: false }),
  { ids: [0, 1] }
);
