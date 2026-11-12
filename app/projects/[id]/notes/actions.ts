import { z } from "zod"
import { createNote, deleteNote, updateNote, type SerializedNoteSummary } from "@/lib/store/notes"

const createSchema = z.object({
  title: z.string().trim().max(160).optional(),
  content: z.string().trim().max(20000).optional(),
})

/**
 * Creates a note straight from the "Take a note…" composer, with no dialog
 * or redirect. Returns the note so the grid can show it at once.
 */
export async function createNoteInlineAction(
  projectId: string,
  input: { title?: string; content?: string }
): Promise<{ ok: boolean; note?: SerializedNoteSummary; error?: string }> {
  const parsed = createSchema.safeParse(input)
  if (!parsed.success) return { ok: false }
  // Clicking away from a blank composer creates nothing.
  if (!parsed.data.title?.trim() && !parsed.data.content?.trim()) return { ok: false }
  const note = await createNote(projectId, {
    title: parsed.data.title?.trim() || "Untitled Note",
    content: parsed.data.content?.trim() || "",
  })
  return note ? { ok: true, note } : { ok: false }
}

const saveSchema = z.object({
  title: z.string().trim().max(160).optional(),
  content: z.string().trim().max(20000).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
})

export type SaveNoteInput = z.infer<typeof saveSchema>

/** A note card's debounced autosave. Only touches the fields it is given. */
export async function saveNoteAction(projectId: string, noteId: string, input: SaveNoteInput): Promise<{ ok: boolean }> {
  const parsed = saveSchema.safeParse(input)
  if (!parsed.success) return { ok: false }
  const patch: SaveNoteInput = {}
  if (parsed.data.title !== undefined) patch.title = parsed.data.title.trim() || "Untitled Note"
  if (parsed.data.content !== undefined) patch.content = parsed.data.content
  if (parsed.data.tags !== undefined) patch.tags = parsed.data.tags
  return { ok: await updateNote(projectId, noteId, patch) }
}

export async function deleteNoteAction(projectId: string, noteId: string): Promise<void> {
  await deleteNote(projectId, noteId)
}

export async function togglePinNoteAction(projectId: string, noteId: string, pinned: boolean): Promise<void> {
  await updateNote(projectId, noteId, { pinned })
}
