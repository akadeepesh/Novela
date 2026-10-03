import "server-only";
import { get, put } from "@vercel/blob";
import { IMPORT_BLOB_ACCESS } from "@/lib/import/config";

/** Where one job's results live in scratch Blob storage — under the owner's prefix, like the uploaded PDF. */
export const importFilePath = (userId: string, jobId: string, name: string) => `imports/${userId}/${jobId}/${name}`;

export async function putImportFile(pathname: string, body: Uint8Array | string, contentType: string) {
  await put(pathname, typeof body === "string" ? body : Buffer.from(body), {
    access: IMPORT_BLOB_ACCESS,
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType,
  });
}

export async function readImportJson<T>(pathname: string): Promise<T | null> {
  const result = await get(pathname, { access: IMPORT_BLOB_ACCESS, useCache: false });
  if (!result || result.statusCode !== 200) return null;
  return JSON.parse(await new Response(result.stream).text()) as T;
}

/** For the asset route: the stream and its type, without buffering the picture. */
export async function openImportFile(pathname: string) {
  const result = await get(pathname, { access: IMPORT_BLOB_ACCESS, useCache: false });
  if (!result || result.statusCode !== 200) return null;
  return result;
}
