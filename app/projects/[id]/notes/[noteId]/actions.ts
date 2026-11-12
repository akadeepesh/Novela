import { z } from "zod"
import { formString } from "@/lib/form"
import { updateNote } from "@/lib/store/notes"
import { TRASHED_PROJECT_ERROR } from "@/lib/store/projects"

const schema = z.object({
  title: z.string().trim().max(160).optional(),
  content: z.string().trim().max(20000).optional(),
  tags: z.string().trim().max(500).optional(),
  pinned: z.boolean().optional(),
})

export type UpdateNoteState = { error?: string; success?: boolean }

export async function updateNoteAction(
  projectId: string,
  noteId: string,
  _prevState: UpdateNoteState,
  formData: FormData
): Promise<UpdateNoteState> {
  const parsed = schema.safeParse({
    title: formString(formData, "title"),
    content: formString(formData, "content"),
    tags: formString(formData, "tags"),
    pinned: formData.get("pinned") === "on",
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the fields and try again." }
  }
  const { tags, title, content, pinned } = parsed.data
  const tagList = tags
    ? tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    : []
  const ok = await updateNote(projectId, noteId, {
    title: title || "Untitled Note",
    content: content ?? "",
    tags: tagList,
    pinned: Boolean(pinned),
  })
  return ok ? { success: true } : { error: TRASHED_PROJECT_ERROR }
}
