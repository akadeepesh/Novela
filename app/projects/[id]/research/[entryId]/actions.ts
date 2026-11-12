import { z } from "zod"
import { formString } from "@/lib/form"
import { updateResearchEntry } from "@/lib/store/notes"
import { TRASHED_PROJECT_ERROR } from "@/lib/store/projects"
import { RESEARCH_ENTRY_TYPES, type ResearchEntryType } from "@/lib/research-config"

const TYPE_VALUES = RESEARCH_ENTRY_TYPES.map((t) => t.value) as [ResearchEntryType, ...ResearchEntryType[]]

const schema = z.object({
  title: z.string().trim().min(1, "Give this entry a title").max(160),
  type: z.enum(TYPE_VALUES),
  // Only web links: anything else (javascript:, data:) must never become a clickable href.
  url: z
    .string()
    .trim()
    .max(2000)
    .refine((v) => v === "" || /^https?:\/\//i.test(v), "Links must start with http:// or https://")
    .optional(),
  content: z.string().trim().max(8000).optional(),
})

export type UpdateResearchEntryState = { error?: string; success?: boolean }

export async function updateResearchEntryAction(
  projectId: string,
  entryId: string,
  _prevState: UpdateResearchEntryState,
  formData: FormData
): Promise<UpdateResearchEntryState> {
  const parsed = schema.safeParse({
    title: formData.get("title"),
    type: formData.get("type"),
    url: formString(formData, "url"),
    content: formString(formData, "content"),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the fields and try again." }
  }
  const { title, type, url, content } = parsed.data
  const ok = await updateResearchEntry(projectId, entryId, { title, type, url: url ?? "", content: content ?? "" })
  return ok ? { success: true } : { error: TRASHED_PROJECT_ERROR }
}
