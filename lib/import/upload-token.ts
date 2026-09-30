import "server-only";
import { generateClientTokenFromReadWriteToken } from "@vercel/blob/client";
import { IMPORT_MAX_BYTES, importBlobPrefix } from "@/lib/import/config";

// Generous enough for a slow connection uploading a multi-part 50 MB file,
// short enough that a leaked token is worthless by lunchtime.
const TOKEN_TTL_MS = 15 * 60 * 1000;

/**
 * Mints the short-lived token the browser uses to put one PDF straight into
 * scratch Blob storage.
 *
 * This deliberately does NOT go through `handleUpload`. That helper always
 * bakes an `onUploadCompleted` callback URL (here: the app's own
 * /api/import/upload) into the token, and Vercel then calls it when the
 * upload finishes. On localhost that URL is unreachable from Vercel's
 * servers, which stalls the upload right at the end; and this flow has no
 * use for the callback anyway — intake runs from the client's follow-up
 * action. No callback in the token means nothing to reach, in dev or prod.
 */
export async function issueImportUploadToken(userId: string, pathname: string): Promise<string> {
  if (!pathname.startsWith(importBlobPrefix(userId))) {
    throw new Error("Invalid upload path");
  }
  return generateClientTokenFromReadWriteToken({
    pathname,
    allowedContentTypes: ["application/pdf"],
    maximumSizeInBytes: IMPORT_MAX_BYTES,
    // Random suffix: the URL is the only thing gating read access to
    // someone's unpublished manuscript, so it must not be guessable.
    addRandomSuffix: true,
    validUntil: Date.now() + TOKEN_TTL_MS,
  });
}
