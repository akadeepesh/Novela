import "server-only";
import { put, del, head } from "@vercel/blob";
import { connectDB } from "@/lib/db";
import { User } from "@/lib/models/user";
import { getEntitlements } from "@/lib/entitlements";

// Covers and manuscript backgrounds are the only images the app stores —
// keep the allow-list and size cap here so both call sites (overview cover
// uploads, manuscript background upload) agree on the same rules.
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

export type ProjectImageKind = "cover-front" | "cover-back" | "background";

export type UploadImageResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

/**
 * Uploads a project-owned image (cover art, custom manuscript background) to
 * Vercel Blob under a per-project, per-kind path. Requires
 * BLOB_READ_WRITE_TOKEN to be set — see .env.local.example.
 */
export async function uploadProjectImage({
  userId,
  projectId,
  kind,
  file,
}: {
  userId: string;
  projectId: string;
  kind: ProjectImageKind;
  file: File;
}): Promise<UploadImageResult> {
  const ext = ALLOWED_TYPES[file.type];
  if (!ext) {
    return { ok: false, error: "Please upload a PNG, JPEG, WEBP, or GIF image." };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, error: "Images must be under 5MB." };
  }
  const { plan, features, storageBytesUsed } = await getEntitlements(userId);
  if (storageBytesUsed + file.size > features.storageBytes) {
    return {
      ok: false,
      error:
        plan === "free"
          ? "You've used all the image storage on the Free plan. Remove an image you no longer need, or upgrade to Pro."
          : "You've used all your image storage. Remove an image you no longer need.",
    };
  }

  // Timestamped filename (not addRandomSuffix) so the URL is predictable
  // enough to reason about, but still unique per upload — replacing an
  // image doesn't collide with the old blob before we get a chance to
  // delete it.
  const pathname = `projects/${projectId}/${kind}-${Date.now()}.${ext}`;

  try {
    const blob = await put(pathname, file, {
      access: "public",
      addRandomSuffix: false,
    });
    await adjustStorage(userId, file.size);
    return { ok: true, url: blob.url };
  } catch (err) {
    console.error("uploadProjectImage: put failed", err);
    return { ok: false, error: "Upload failed. Try again." };
  }
}

/** Best-effort delete — a failure here shouldn't block the DB write that already succeeded. */
export async function deleteProjectImage(userId: string, url: string | null | undefined) {
  if (!url) return;
  try {
    // The stored size, so the account's storage use goes down by exactly
    // what the upload added.
    const { size } = await head(url);
    await del(url);
    await adjustStorage(userId, -size);
  } catch (err) {
    console.error("deleteProjectImage: del failed", err);
  }
}

/** Adds (or, with a negative delta, removes) bytes from the account's storage use, never below 0. */
async function adjustStorage(userId: string, delta: number) {
  await connectDB();
  await User.updateOne({ _id: userId }, [
    { $set: { storageBytes: { $max: [0, { $add: [{ $ifNull: ["$storageBytes", 0] }, delta] }] } } },
  ]);
}
