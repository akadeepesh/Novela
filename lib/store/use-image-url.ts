"use client"

import { useEffect, useState } from "react"
import { useLiveQuery } from "dexie-react-hooks"
import { getAssetBlob, isAssetRef } from "./assets"

/**
 * Turns an image reference into something an <img> or CSS can use: a
 * locally stored `asset:` image becomes an object URL (revoked when no
 * longer needed); a plain URL is returned unchanged.
 */
export function useImageUrl(ref: string | undefined | null): string | undefined {
  const local = isAssetRef(ref)
  const blob = useLiveQuery(() => (local ? getAssetBlob(ref) : Promise.resolve(null)), [ref, local])
  const [objectUrl, setObjectUrl] = useState<{ blob: Blob; url: string } | null>(null)

  useEffect(() => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the URL must be created and revoked alongside the blob
    setObjectUrl({ blob, url })
    return () => URL.revokeObjectURL(url)
  }, [blob])

  if (!ref) return undefined
  if (!local) return ref
  return blob && objectUrl?.blob === blob ? objectUrl.url : undefined
}
