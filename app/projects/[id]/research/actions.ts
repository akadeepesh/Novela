import { z } from "zod"
import {
  createResearchEntry,
  deleteResearchEntry,
  updateResearchEntry,
  type SerializedResearchEntrySummary,
} from "@/lib/store/notes"
import { fetchUrlPreviewAction } from "@/app/actions/url-preview"

const urlSchema = z.string().trim().min(1).max(2000)

/**
 * Paste a link on the Research board and it becomes a bookmark card. The
 * link (and only the link) goes to our server, which reads the page's
 * title, image and icon; the card itself is stored in this browser.
 */
export async function createLinkEntryAction(
  projectId: string,
  rawUrl: string
): Promise<{ ok: boolean; entry?: SerializedResearchEntrySummary; error?: string }> {
  const parsedUrl = urlSchema.safeParse(rawUrl)
  if (!parsedUrl.success) return { ok: false, error: "Paste a link first." }

  let normalized = parsedUrl.data
  if (!/^https?:\/\//i.test(normalized)) normalized = `https://${normalized}`

  const preview = await fetchUrlPreviewAction(normalized).catch(() => null)
  if (!preview) return { ok: false, error: "That doesn't look like a valid link, or it couldn't be reached." }

  const entry = await createResearchEntry(projectId, {
    title: preview.title,
    type: "link",
    url: normalized,
    imageUrl: preview.imageUrl,
    faviconUrl: preview.faviconUrl,
    siteName: preview.siteName,
  })
  return entry ? { ok: true, entry } : { ok: false }
}

const noteSchema = z.object({
  title: z.string().trim().max(160).optional(),
  content: z.string().trim().max(8000).optional(),
})

/** A "quick note" for research with no URL: a book, a conversation, anything offline. */
export async function createQuickNoteEntryAction(
  projectId: string,
  input: { title?: string; content?: string }
): Promise<{ ok: boolean; entry?: SerializedResearchEntrySummary; error?: string }> {
  const parsed = noteSchema.safeParse(input)
  if (!parsed.success) return { ok: false }
  if (!parsed.data.title?.trim() && !parsed.data.content?.trim()) return { ok: false }
  const entry = await createResearchEntry(projectId, {
    title: parsed.data.title?.trim() || "Untitled note",
    type: "note",
    content: parsed.data.content?.trim() || "",
  })
  return entry ? { ok: true, entry } : { ok: false }
}

export async function deleteResearchEntryAction(projectId: string, entryId: string): Promise<void> {
  await deleteResearchEntry(projectId, entryId)
}

const fieldsSchema = z.object({
  title: z.string().trim().max(160).optional(),
  content: z.string().trim().max(8000).optional(),
})

export type SaveResearchEntryFieldsInput = z.infer<typeof fieldsSchema>

/** Inline title/caption edits from a card's debounced autosave. */
export async function saveResearchEntryFieldsAction(
  projectId: string,
  entryId: string,
  input: SaveResearchEntryFieldsInput
): Promise<{ ok: boolean }> {
  const parsed = fieldsSchema.safeParse(input)
  if (!parsed.success) return { ok: false }
  const patch: SaveResearchEntryFieldsInput = {}
  if (parsed.data.title !== undefined) patch.title = parsed.data.title.trim() || "Untitled"
  if (parsed.data.content !== undefined) patch.content = parsed.data.content
  return { ok: await updateResearchEntry(projectId, entryId, patch) }
}
