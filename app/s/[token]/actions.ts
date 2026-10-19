"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import { Chapter } from "@/lib/models/chapter";
import { Comment } from "@/lib/models/comment";
import { safeAction } from "@/lib/safe-action";
import { MAX_QUOTE_LENGTH } from "@/lib/comments";
import { withinRateLimit } from "@/lib/rate-limit";
import { clientAddress, findActiveShare, isShareUnlocked, rememberShareUnlock } from "@/lib/share";

const HOUR = 60 * 60 * 1000;

/** Checks a share link's password; on success this browser stays unlocked for 30 days. */
export const unlockShareAction = safeAction(
  "unlockShareAction",
  async (token: string, password: string): Promise<{ ok: true } | { ok: false; error: string }> => {
    const share = await findActiveShare(token);
    if (!share) return { ok: false, error: "This link no longer works." };
    if (!share.passwordHash) return { ok: true };
    // Slows down guessing: a handful of tries per hour per address and link.
    if (!(await withinRateLimit(`share-pw:${share.linkId}:${await clientAddress()}`, 10, HOUR))) {
      return { ok: false, error: "Too many attempts. Try again in an hour." };
    }
    if (typeof password !== "string" || !(await bcrypt.compare(password.slice(0, 100), share.passwordHash))) {
      return { ok: false, error: "That password isn't right." };
    }
    await rememberShareUnlock(share, token);
    return { ok: true };
  },
  () => ({ ok: false as const, error: "Something went wrong. Please try again." })
);

const commentSchema = z.object({
  chapterId: z.string().regex(/^[a-f0-9]{24}$/i),
  name: z.string().trim().min(1).max(60),
  body: z.string().trim().min(1).max(2000),
  quote: z.string().max(5000).optional(),
});

/** A beta reader's comment, left through a share link that allows comments. */
export const addReaderCommentAction = safeAction(
  "addReaderCommentAction",
  async (
    token: string,
    input: { chapterId: string; name: string; body: string; quote?: string }
  ): Promise<{ ok: true } | { ok: false; error: string }> => {
    const parsed = commentSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Add your name and a comment (up to 2,000 characters)." };

    const share = await findActiveShare(token);
    if (!share || !share.allowComments) return { ok: false, error: "Comments are turned off for this link." };
    if (!(await isShareUnlocked(share))) return { ok: false, error: "Enter the link's password first." };
    if (!(await withinRateLimit(`share-comment:${share.linkId}:${await clientAddress()}`, 30, HOUR))) {
      return { ok: false, error: "You've left a lot of comments in a short time. Please wait a little and try again." };
    }

    await connectDB();
    const { chapterId, name, body, quote } = parsed.data;
    const chapter = await Chapter.exists({
      _id: chapterId,
      projectId: share.project.id,
      ownerId: share.ownerId,
      deletedAt: null,
    });
    if (!chapter) return { ok: false, error: "That chapter isn't available any more." };

    await Comment.create({
      projectId: share.project.id,
      chapterId,
      ownerId: share.ownerId,
      authorKind: "reader",
      authorName: name,
      shareLinkId: share.linkId,
      body,
      quote: (quote ?? "").trim().slice(0, MAX_QUOTE_LENGTH),
      seenByOwner: false,
    });
    revalidatePath("/dashboard");
    return { ok: true };
  },
  () => ({ ok: false as const, error: "Couldn't send your comment. Please try again." })
);
