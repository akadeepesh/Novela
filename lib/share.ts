import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { connectDB } from "@/lib/db";
import { ShareLink } from "@/lib/models/share-link";
import { loadProjectById, type SerializedProject } from "@/lib/projects";

export type SerializedShareLink = {
  id: string;
  token: string;
  name: string;
  allowComments: boolean;
  hasPassword: boolean;
  expiresAt: string | null;
  viewCount: number;
  lastViewedAt: string | null;
  createdAt: string;
};

export function serializeShareLink(doc: Record<string, unknown>): SerializedShareLink {
  return {
    id: String(doc._id),
    token: doc.token as string,
    name: (doc.name as string) ?? "",
    allowComments: Boolean(doc.allowComments),
    hasPassword: Boolean(doc.passwordHash),
    expiresAt: doc.expiresAt ? new Date(doc.expiresAt as string).toISOString() : null,
    viewCount: (doc.viewCount as number) ?? 0,
    lastViewedAt: doc.lastViewedAt ? new Date(doc.lastViewedAt as string).toISOString() : null,
    createdAt: new Date(doc.createdAt as string).toISOString(),
  };
}

export function newShareToken(): string {
  return randomBytes(24).toString("base64url");
}

/** Links that still work: not revoked, not expired. */
export function activeLinkFilter(now = new Date()) {
  return { revokedAt: null, $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] };
}

export type ActiveShare = {
  linkId: string;
  allowComments: boolean;
  passwordHash: string | null;
  project: SerializedProject;
  ownerId: string;
};

/**
 * The project behind a share token, if the link still works and the project
 * isn't in the Trash. No sign-in involved: the token is the permission.
 */
export async function findActiveShare(token: string): Promise<ActiveShare | null> {
  if (typeof token !== "string" || token.length < 20 || token.length > 64) return null;
  await connectDB();
  const link = await ShareLink.findOne({ token, ...activeLinkFilter() })
    .select("+passwordHash projectId ownerId allowComments")
    .lean<{ _id: unknown; projectId: unknown; ownerId: unknown; allowComments?: boolean; passwordHash?: string }>();
  if (!link) return null;
  const project = await loadProjectById(String(link.projectId));
  if (!project) return null;
  return {
    linkId: String(link._id),
    allowComments: Boolean(link.allowComments),
    passwordHash: link.passwordHash ?? null,
    project,
    ownerId: String(link.ownerId),
  };
}

export async function recordShareView(linkId: string) {
  await ShareLink.updateOne(
    { _id: linkId },
    { $inc: { viewCount: 1 }, $set: { lastViewedAt: new Date() } },
    { timestamps: false }
  );
}

// ---- Password-protected links -------------------------------------------
// After the right password, the browser gets a cookie proving it, scoped to
// this link and to its current password: changing or removing the password
// invalidates every earlier unlock.

function unlockCookieName(linkId: string) {
  return `share-${linkId}`;
}

function unlockProof(linkId: string, passwordHash: string): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return createHmac("sha256", secret).update(`${linkId}:${passwordHash}`).digest("base64url");
}

export async function isShareUnlocked(share: ActiveShare): Promise<boolean> {
  if (!share.passwordHash) return true;
  const value = (await cookies()).get(unlockCookieName(share.linkId))?.value;
  if (!value) return false;
  const expected = Buffer.from(unlockProof(share.linkId, share.passwordHash));
  const given = Buffer.from(value);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export async function rememberShareUnlock(share: ActiveShare, token: string) {
  if (!share.passwordHash) return;
  (await cookies()).set(unlockCookieName(share.linkId), unlockProof(share.linkId, share.passwordHash), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: `/s/${token}`,
    maxAge: 60 * 60 * 24 * 30,
  });
}

/** Best-effort client address, for rate limits only. */
export async function clientAddress(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}
