import { z } from "zod"
import { formString } from "@/lib/form"
import { createWorldEntry, updateWorldEntry, type WorldEntryFields } from "@/lib/store/bible"
import { TRASHED_PROJECT_ERROR } from "@/lib/store/projects"
import { WORLD_ENTRY_TYPES, type WorldEntryType } from "@/lib/world-config"

const TYPE_VALUES = WORLD_ENTRY_TYPES.map((t) => t.value) as [WorldEntryType, ...WorldEntryType[]]

const schema = z.object({
  name: z.string().trim().min(1, "Give this entry a name").max(120),
  type: z.enum(TYPE_VALUES),
  aliases: z.string().trim().max(500).optional(),
  imageUrl: z.string().trim().max(2000).optional(),
  description: z.string().trim().max(4000).optional(),
  notes: z.string().trim().max(4000).optional(),
})

export type UpdateWorldEntryState = {
  error?: string
  success?: boolean
  /** Set after creating: the page to open next. */
  redirectTo?: string
}

function splitList(value: string | undefined): string[] {
  return value
    ? value
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean)
    : []
}

function parse(formData: FormData): { ok: true; fields: WorldEntryFields } | { ok: false; error: string } {
  const parsed = schema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    aliases: formString(formData, "aliases"),
    imageUrl: formString(formData, "imageUrl"),
    description: formString(formData, "description"),
    notes: formString(formData, "notes"),
  })
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the fields and try again." }
  const d = parsed.data
  return {
    ok: true,
    fields: {
      name: d.name,
      type: d.type,
      aliases: splitList(d.aliases),
      imageUrl: d.imageUrl ?? "",
      description: d.description ?? "",
      notes: d.notes ?? "",
    },
  }
}

export async function updateWorldEntryAction(
  projectId: string,
  entryId: string,
  _prevState: UpdateWorldEntryState,
  formData: FormData
): Promise<UpdateWorldEntryState> {
  const parsed = parse(formData)
  if (!parsed.ok) return { error: parsed.error }
  return (await updateWorldEntry(projectId, entryId, parsed.fields)) ? { success: true } : { error: TRASHED_PROJECT_ERROR }
}

/**
 * Creates the record from the blank "new" form. Nothing exists until this
 * runs, so opening the form and walking away leaves no stray record.
 */
export async function createWorldEntryFromFormAction(
  projectId: string,
  _prevState: UpdateWorldEntryState,
  formData: FormData
): Promise<UpdateWorldEntryState> {
  const parsed = parse(formData)
  if (!parsed.ok) return { error: parsed.error }
  const id = await createWorldEntry(projectId, parsed.fields)
  if (!id) return { error: TRASHED_PROJECT_ERROR }
  return { redirectTo: `/projects/${projectId}/world/${id}` }
}
