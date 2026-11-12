import { z } from "zod"
import {
  createChapter,
  deleteChapterForever,
  reorderChapters,
  restoreChapter,
  trashChapter,
  updateChapterMeta,
  type CreateChapterResult,
} from "@/lib/store/chapters"
import { getProject } from "@/lib/store/projects"
import { sectionLabelSingular } from "@/lib/project-config"
import { CHAPTER_LABELS } from "@/lib/chapter-config"

export type { CreateChapterResult }

/**
 * Creates a chapter from the draft editor, on the person's FIRST change.
 * Opening "New chapter" creates nothing, so browsing around never leaves
 * empty chapters behind.
 */
export async function createChapterFromDraftAction(
  projectId: string,
  input: { title?: string; content?: unknown }
): Promise<CreateChapterResult> {
  const project = await getProject(projectId)
  if (!project) return { ok: false, code: "not_found" }
  try {
    return await createChapter(projectId, input, sectionLabelSingular("chapters", project.type))
  } catch (err) {
    console.error("createChapter failed", err)
    return { ok: false, code: "error" }
  }
}

/** Saves a new reading order; refused if the chapter set changed meanwhile. */
export async function reorderChaptersAction(projectId: string, orderedIds: string[]): Promise<{ ok: boolean }> {
  return { ok: await reorderChapters(projectId, orderedIds) }
}

const metaSchema = z.object({
  status: z.enum(["draft", "in-progress", "done"]).optional(),
  synopsis: z.string().trim().max(1000).optional(),
  label: z.enum(CHAPTER_LABELS).optional(),
})

export type ChapterMetaInput = z.infer<typeof metaSchema>

/** Status, synopsis and colour label: the outline-board details. */
export async function updateChapterMetaAction(
  projectId: string,
  chapterId: string,
  input: ChapterMetaInput
): Promise<{ ok: boolean }> {
  const parsed = metaSchema.safeParse(input)
  if (!parsed.success) return { ok: false }
  return { ok: await updateChapterMeta(projectId, chapterId, parsed.data) }
}

/** Moves a chapter to the Trash. Nothing is deleted; it can be restored for 30 days. */
export async function trashChapterAction(projectId: string, chapterId: string): Promise<{ ok: boolean }> {
  return { ok: await trashChapter(projectId, chapterId) }
}

/** Brings a chapter back from the Trash, at the end of the book. */
export async function restoreChapterAction(
  projectId: string,
  chapterId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  return restoreChapter(projectId, chapterId)
}

/** Permanently deletes a chapter that is already in the Trash, with its versions and comments. */
export async function deleteChapterForeverAction(projectId: string, chapterId: string): Promise<{ ok: boolean }> {
  return { ok: await deleteChapterForever(projectId, chapterId) }
}
