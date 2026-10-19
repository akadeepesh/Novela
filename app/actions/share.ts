"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import { ShareLink } from "@/lib/models/share-link";
import { ownsActiveProject, requireUserId } from "@/lib/projects";
import { getEntitlements } from "@/lib/entitlements";
import { safeAction } from "@/lib/safe-action";
import { activeLinkFilter, newShareToken, serializeShareLink, type SerializedShareLink } from "@/lib/share";

/** The project's links that still work, newest first. */
export const listShareLinksAction = safeAction(
  "listShareLinksAction",
  async (projectId: string): Promise<{ ok: true; links: SerializedShareLink[] } | { ok: false }> => {
    const userId = await requireUserId();
    if (!(await ownsActiveProject(userId, projectId))) return { ok: false };
    const docs = await ShareLink.find({ projectId, ownerId: userId, ...activeLinkFilter() })
      .select("+passwordHash")
      .sort({ createdAt: -1 })
      .lean<Record<string, unknown>[]>();
    return { ok: true, links: docs.map(serializeShareLink) };
  },
  () => ({ ok: false as const }),
  { ids: [0] }
);

const createSchema = z.object({
  name: z.string().trim().max(60).optional(),
  allowComments: z.boolean().optional(),
  password: z.string().max(100).optional(),
  expiresInDays: z.number().int().min(1).max(365).optional(),
});

export type CreateShareLinkInput = z.infer<typeof createSchema>;

export const createShareLinkAction = safeAction(
  "createShareLinkAction",
  async (
    projectId: string,
    input: CreateShareLinkInput
  ): Promise<{ ok: true; link: SerializedShareLink } | { ok: false; error: string }> => {
    const userId = await requireUserId();
    const parsed = createSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Check the link settings and try again." };
    if (!(await ownsActiveProject(userId, projectId))) return { ok: false, error: "Couldn't find this project." };

    const { plan, features } = await getEntitlements(userId);
    const { name, allowComments, password, expiresInDays } = parsed.data;
    const wantsPro = Boolean(allowComments || password || expiresInDays);
    if (wantsPro && !features.readerComments) {
      return { ok: false, error: "Reader comments, passwords and expiry dates are part of Pro." };
    }
    const active = await ShareLink.countDocuments({ projectId, ownerId: userId, ...activeLinkFilter() });
    if (active >= features.shareLinks) {
      return {
        ok: false,
        error:
          plan === "free"
            ? "The Free plan includes one reader link per book. Revoke it to make a new one, or upgrade to Pro."
            : "You've reached the maximum number of links for this book. Revoke one first.",
      };
    }

    const doc = await ShareLink.create({
      projectId,
      ownerId: userId,
      token: newShareToken(),
      name: name ?? "",
      allowComments: Boolean(allowComments),
      passwordHash: password ? await bcrypt.hash(password, 10) : undefined,
      expiresAt: expiresInDays ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000) : undefined,
    });
    revalidatePath(`/projects/${projectId}/overview`);
    return { ok: true, link: serializeShareLink(doc.toObject()) };
  },
  () => ({ ok: false as const, error: "Couldn't create the link. Please try again." }),
  { ids: [0] }
);

/** Stops a link working, immediately and for good. Comments already left are kept. */
export const revokeShareLinkAction = safeAction(
  "revokeShareLinkAction",
  async (projectId: string, linkId: string): Promise<{ ok: boolean }> => {
    const userId = await requireUserId();
    await connectDB();
    const result = await ShareLink.updateOne(
      { _id: linkId, projectId, ownerId: userId, revokedAt: null },
      { $set: { revokedAt: new Date() } }
    );
    revalidatePath(`/projects/${projectId}/overview`);
    return { ok: result.matchedCount > 0 };
  },
  () => ({ ok: false }),
  { ids: [0, 1] }
);
