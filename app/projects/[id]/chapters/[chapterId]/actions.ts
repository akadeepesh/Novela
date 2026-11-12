import { z } from "zod"
import { saveChapter, type SaveChapterInput, type SaveChapterResult } from "@/lib/store/chapters"
import { updateManuscriptSettings } from "@/lib/store/projects"
import { deleteAsset, saveImage } from "@/lib/store/assets"
import {
  createManualSnapshot,
  findVersionContent,
  listVersionsForChapter,
  restoreVersion,
  type SerializedVersion,
} from "@/lib/store/versions"
import { BACKGROUND_IDS, CUSTOM_BACKGROUND_ID, FONT_FAMILIES, LINE_WIDTHS } from "@/lib/manuscript-config"
import { tiptapToBlocks, runsText } from "@/lib/export/document-model"
import { diffWords, type DiffPart } from "@/lib/text-diff"

export type { SaveChapterInput, SaveChapterResult }

export async function saveChapterAction(
  projectId: string,
  chapterId: string,
  input: SaveChapterInput
): Promise<SaveChapterResult> {
  try {
    return await saveChapter(projectId, chapterId, input)
  } catch (err) {
    console.error("saveChapter failed", err)
    return { ok: false, code: "error" }
  }
}

export async function createVersionAction(
  projectId: string,
  chapterId: string,
  label?: string
): Promise<{ ok: boolean; error?: string }> {
  return createManualSnapshot(projectId, chapterId, label)
}

export async function restoreVersionAction(projectId: string, chapterId: string, versionId: string): Promise<{ ok: boolean }> {
  return restoreVersion(projectId, chapterId, versionId)
}

export async function listVersionsAction(
  projectId: string,
  chapterId: string
): Promise<{ ok: true; versions: SerializedVersion[] } | { ok: false }> {
  return { ok: true, versions: await listVersionsForChapter(projectId, chapterId) }
}

export async function getVersionDiffAction(
  projectId: string,
  chapterId: string,
  versionId: string,
  currentContent: unknown
): Promise<{ ok: true; title: string; wordCount: number; diff: DiffPart[] } | { ok: false }> {
  const version = await findVersionContent(projectId, chapterId, versionId)
  if (!version) return { ok: false }
  const oldText = runsText(tiptapToBlocks(version.content).flatMap((b) => b.runs))
  const newText = runsText(tiptapToBlocks(currentContent).flatMap((b) => b.runs))
  return { ok: true, title: version.title, wordCount: version.wordCount, diff: diffWords(oldText, newText) }
}

const manuscriptSettingsSchema = z.object({
  background: z.enum(BACKGROUND_IDS as [string, ...string[]]).optional(),
  showHeader: z.boolean().optional(),
  headerText: z.string().trim().max(120).optional(),
  showFooter: z.boolean().optional(),
  footerText: z.string().trim().max(120).optional(),
  fontSize: z.number().min(14).max(28).optional(),
  lineHeight: z.number().min(1.3).max(2.2).optional(),
  lineWidth: z.enum(LINE_WIDTHS).optional(),
  fontFamily: z.enum(FONT_FAMILIES).optional(),
})

export type ManuscriptSettingsInput = z.infer<typeof manuscriptSettingsSchema>

export async function updateManuscriptSettingsAction(projectId: string, input: ManuscriptSettingsInput): Promise<{ ok: boolean }> {
  const parsed = manuscriptSettingsSchema.safeParse(input)
  if (!parsed.success) return { ok: false }
  return { ok: Boolean(await updateManuscriptSettings(projectId, parsed.data)) }
}

export type UploadBackgroundState = { error?: string; url?: string }

/**
 * Stores a custom manuscript background and switches the project to it in
 * one step: the "custom" swatch only appears once an image exists.
 */
export async function uploadManuscriptBackgroundAction(
  projectId: string,
  _prevState: UploadBackgroundState,
  formData: FormData
): Promise<UploadBackgroundState> {
  const file = formData.get("file")
  if (!(file instanceof File) || file.size === 0) return { error: "Choose an image first." }
  const saved = await saveImage(projectId, file)
  if (!saved.ok) return { error: saved.error }
  const previous = await updateManuscriptSettings(projectId, {
    backgroundImageUrl: saved.ref,
    background: CUSTOM_BACKGROUND_ID,
  })
  if (!previous) {
    await deleteAsset(saved.ref)
    return { error: "Couldn't find this project." }
  }
  await deleteAsset(previous.manuscriptSettings?.backgroundImageUrl)
  return { url: saved.ref }
}

/** Clears the custom background and drops back to the "paper" preset. */
export async function removeManuscriptBackgroundAction(projectId: string): Promise<{ ok: boolean }> {
  const previous = await updateManuscriptSettings(projectId, { backgroundImageUrl: "", background: "paper" })
  if (!previous) return { ok: false }
  await deleteAsset(previous.manuscriptSettings?.backgroundImageUrl)
  return { ok: true }
}
