import { z } from "zod"
import { formString } from "@/lib/form"
import { updateProject } from "@/lib/store/projects"
import { deleteAsset, saveImage } from "@/lib/store/assets"
import { CHAPTER_NUMBERING_STYLE_IDS, type ChapterNumberingStyle } from "@/lib/chapter-numbering"
import { TRIM_SIZE_IDS, type TrimSizeId } from "@/lib/export-config"

const NOT_FOUND = "Couldn't find this project."

const schema = z.object({
  title: z.string().trim().min(1, "Give your project a title").max(200),
  authorName: z.string().trim().max(120).optional(),
})

export type UpdateOverviewState = { error?: string; success?: boolean }

export async function updateOverviewAction(
  projectId: string,
  _prevState: UpdateOverviewState,
  formData: FormData
): Promise<UpdateOverviewState> {
  const parsed = schema.safeParse({
    title: formData.get("title"),
    authorName: formString(formData, "authorName"),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the fields and try again." }
  }
  return (await updateProject(projectId, parsed.data)) ? { success: true } : { error: NOT_FOUND }
}

export type CoverSide = "front" | "back"
export type UploadCoverState = { error?: string; url?: string }

/** Stores a front or back cover image, replacing (and deleting) any previous one. */
export async function uploadCoverAction(
  projectId: string,
  side: CoverSide,
  _prevState: UploadCoverState,
  formData: FormData
): Promise<UploadCoverState> {
  const file = formData.get("file")
  if (!(file instanceof File) || file.size === 0) return { error: "Choose an image first." }

  const saved = await saveImage(projectId, file)
  if (!saved.ok) return { error: saved.error }

  const field = side === "front" ? "coverFrontUrl" : "coverBackUrl"
  const previous = await updateProject(projectId, { [field]: saved.ref })
  if (!previous) {
    await deleteAsset(saved.ref)
    return { error: NOT_FOUND }
  }
  // Only once the new image is saved is the old one removed.
  await deleteAsset(previous[field])
  return { url: saved.ref }
}

/** Clears a cover slot. Read View and export fall back to the generated typographic cover. */
export async function removeCoverAction(projectId: string, side: CoverSide): Promise<{ ok: boolean }> {
  const field = side === "front" ? "coverFrontUrl" : "coverBackUrl"
  const previous = await updateProject(projectId, { [field]: "" })
  if (!previous) return { ok: false }
  await deleteAsset(previous[field])
  return { ok: true }
}

const structureSchema = z.object({
  chapterNumberingStyle: z.enum(CHAPTER_NUMBERING_STYLE_IDS as [string, ...string[]]).optional(),
  chapterNumberingPrefix: z.string().trim().max(40).optional(),
  exportTrimSize: z.enum(TRIM_SIZE_IDS as [string, ...string[]]).optional(),
})
export type StructureInput = z.infer<typeof structureSchema>

/** Chapter numbering style and export trim size: instantly-saved project defaults. */
export async function updateStructureSettingsAction(projectId: string, input: StructureInput): Promise<{ ok: boolean }> {
  const parsed = structureSchema.safeParse(input)
  if (!parsed.success) return { ok: false }
  const { chapterNumberingStyle, chapterNumberingPrefix, exportTrimSize } = parsed.data
  const patch = {
    ...(chapterNumberingStyle !== undefined && { chapterNumberingStyle: chapterNumberingStyle as ChapterNumberingStyle }),
    ...(chapterNumberingPrefix !== undefined && { chapterNumberingPrefix }),
    ...(exportTrimSize !== undefined && { exportTrimSize: exportTrimSize as TrimSizeId }),
  }
  return { ok: Boolean(await updateProject(projectId, patch)) }
}

const blurbSchema = z.object({ blurb: z.string().trim().max(600).optional() })
export type UpdateBackCoverBlurbState = { error?: string; success?: boolean }

/** The back-cover blurb, stored in the project's `blurb` field. */
export async function updateBackCoverBlurbAction(
  projectId: string,
  _prevState: UpdateBackCoverBlurbState,
  formData: FormData
): Promise<UpdateBackCoverBlurbState> {
  const parsed = blurbSchema.safeParse({ blurb: formData.get("blurb") ?? undefined })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the field and try again." }
  }
  return (await updateProject(projectId, { blurb: parsed.data.blurb ?? "" })) ? { success: true } : { error: NOT_FOUND }
}
