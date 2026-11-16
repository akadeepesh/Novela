/** Keep titles recognizable in download names, including scripts with combining marks. */
export function slugify(text: string, fallback = "book"): string {
  const slug = text
    .toLowerCase()
    .normalize("NFC")
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, "-")
    .replace(/(^-|-$)/g, "")

  // Count Unicode characters rather than cutting a surrogate pair in half.
  return Array.from(slug).slice(0, 100).join("").replace(/-$/, "") || fallback
}
