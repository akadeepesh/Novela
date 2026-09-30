import "server-only";
import { del, get } from "@vercel/blob";
import { IMPORT_BLOB_ACCESS, IMPORT_MAX_BYTES, importBlobPrefix } from "@/lib/import/config";

/**
 * The intake action receives a pathname from the browser. It must only ever
 * touch scratch files under *this user's* prefix — which is all the upload
 * route ever lets them create — and never anything the client can steer
 * elsewhere in the store.
 */
export function isOwnedImportPathname(pathname: unknown, userId: string): pathname is string {
  return (
    typeof pathname === "string" &&
    pathname.length <= 1000 &&
    pathname.startsWith(importBlobPrefix(userId)) &&
    !pathname.includes("..") &&
    !pathname.includes("\\")
  );
}

export type ReadImportResult =
  | { ok: true; bytes: Uint8Array }
  | { ok: false; reason: "missing" | "too-large" };

/**
 * Reads a scratch PDF back from Blob as bytes, stopping as soon as it
 * exceeds the size cap rather than buffering an oversized file first.
 */
export async function readImportBlob(pathname: string): Promise<ReadImportResult> {
  const result = await get(pathname, { access: IMPORT_BLOB_ACCESS, useCache: false });
  if (!result || result.statusCode !== 200) return { ok: false, reason: "missing" };
  if (result.blob.size > IMPORT_MAX_BYTES) {
    await result.stream.cancel().catch(() => {});
    return { ok: false, reason: "too-large" };
  }

  const reader = result.stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > IMPORT_MAX_BYTES) {
      await reader.cancel().catch(() => {});
      return { ok: false, reason: "too-large" };
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.length;
  }
  return { ok: true, bytes };
}

/** Best-effort, like deleteProjectImage — a failed cleanup must never fail the request that triggered it. */
export async function deleteImportBlob(pathname: string | null | undefined) {
  if (!pathname) return;
  try {
    await del(pathname);
  } catch (err) {
    console.error("deleteImportBlob: del failed", err);
  }
}
