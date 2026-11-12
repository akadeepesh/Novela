import { db, newId, nowIso } from "./db"

/**
 * Uploaded images (covers, manuscript backgrounds) are stored as Blobs in
 * IndexedDB. A record field that points at one holds `asset:<id>`; anything
 * else (an http(s) URL someone typed in) is used as-is.
 */

const PREFIX = "asset:"

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
export const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"]

export function isAssetRef(ref: string | undefined | null): ref is string {
  return typeof ref === "string" && ref.startsWith(PREFIX)
}

function assetId(ref: string): string {
  return ref.slice(PREFIX.length)
}

export type SaveImageResult = { ok: true; ref: string } | { ok: false; error: string }

/** Checks and stores an image file for a project, returning its `asset:` reference. */
export async function saveImage(projectId: string, file: File | Blob): Promise<SaveImageResult> {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return { ok: false, error: "Use a PNG, JPEG, WebP or GIF image." }
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, error: "That image is over 5 MB. Try a smaller one." }
  }
  const id = newId()
  await db().assets.add({ id, projectId, blob: file, type: file.type, size: file.size, createdAt: nowIso() })
  return { ok: true, ref: PREFIX + id }
}

/** Deletes a stored image. Does nothing for empty values or plain URLs. */
export async function deleteAsset(ref: string | undefined | null): Promise<void> {
  if (!isAssetRef(ref)) return
  await db().assets.delete(assetId(ref))
}

export async function getAssetBlob(ref: string | undefined | null): Promise<Blob | null> {
  if (!isAssetRef(ref)) return null
  return (await db().assets.get(assetId(ref)))?.blob ?? null
}

/** A data: URL for an image reference, for places that can't use object URLs (e.g. export). */
export async function resolveImageToDataUrl(ref: string | undefined | null): Promise<string | undefined> {
  if (!ref) return undefined
  if (!isAssetRef(ref)) return ref
  const blob = await getAssetBlob(ref)
  if (!blob) return undefined
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}
