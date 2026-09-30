import "server-only";
import { del } from "@vercel/blob";
import { importBlobPrefix } from "@/lib/import/config";

/**
 * The intake action receives a Blob URL from the browser. It must never
 * fetch an arbitrary URL on the client's say-so (that's an SSRF hole), so
 * the URL has to be an https Vercel Blob URL living under *this user's*
 * scratch prefix — exactly what the upload-token route only ever issues.
 */
export function isOwnedImportUrl(rawUrl: string, userId: string): boolean {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }
  return (
    url.protocol === "https:" &&
    url.hostname.endsWith(".public.blob.vercel-storage.com") &&
    url.pathname.startsWith(`/${importBlobPrefix(userId)}`)
  );
}

/** Best-effort, like deleteProjectImage — a failed cleanup must never fail the request that triggered it. */
export async function deleteImportBlob(url: string | null | undefined) {
  if (!url) return;
  try {
    await del(url);
  } catch (err) {
    console.error("deleteImportBlob: del failed", err);
  }
}
