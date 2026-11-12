/** sha256 of a JSON string, as hex. Used to tell whether a chapter's text really changed. */
export async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest("SHA-256", bytes)
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("")
}

/** sha256 of any JSON-safe value. */
export function hashContent(content: unknown): Promise<string> {
  return sha256Hex(JSON.stringify(content ?? null))
}
