"use server"

import { fetchUrlPreview, type UrlPreview } from "@/lib/url-preview"

/**
 * The one server call that involves anything the writer typed: the link
 * they pasted on the Research board. Only the URL is sent; the server
 * fetches that page's title, image and icon and returns them. Nothing is
 * stored on the server.
 */
export async function fetchUrlPreviewAction(url: string): Promise<UrlPreview | null> {
  if (typeof url !== "string" || url.length > 2000 || !/^https?:\/\//i.test(url)) return null
  try {
    return await fetchUrlPreview(url)
  } catch {
    return null
  }
}
