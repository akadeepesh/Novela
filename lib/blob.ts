import "server-only";
import { put, del } from "@vercel/blob";

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
  projectId,
  kind,
  file,
}: {
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
    return { ok: true, url: blob.url };
  } catch (err) {
    console.error("uploadProjectImage: put failed", err);
    return { ok: false, error: "Upload failed. Try again." };
  }
}

/** Best-effort delete — a failure here shouldn't block the DB write that already succeeded. */
export async function deleteProjectImage(url: string | null | undefined) {
  if (!url) return;
  try {
    await del(url);
  } catch (err) {
    console.error("deleteProjectImage: del failed", err);
  }
}
