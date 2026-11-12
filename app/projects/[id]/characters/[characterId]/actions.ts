import { z } from "zod"
import { formString } from "@/lib/form"
import { createCharacter, updateCharacter, type CharacterFields } from "@/lib/store/bible"
import { TRASHED_PROJECT_ERROR } from "@/lib/store/projects"
import { CHARACTER_ROLES, type CharacterRole } from "@/lib/character-config"

const ROLE_VALUES = CHARACTER_ROLES.map((r) => r.value) as [CharacterRole, ...CharacterRole[]]

const schema = z.object({
  name: z.string().trim().min(1, "Give this character a name").max(120),
  role: z.enum(ROLE_VALUES),
  aliases: z.string().trim().max(500).optional(),
  imageUrl: z.string().trim().max(2000).optional(),
  appearance: z.string().trim().max(4000).optional(),
  personality: z.string().trim().max(4000).optional(),
  backstory: z.string().trim().max(4000).optional(),
  notes: z.string().trim().max(4000).optional(),
})

export type UpdateCharacterState = {
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

function parse(formData: FormData): { ok: true; fields: CharacterFields } | { ok: false; error: string } {
  const parsed = schema.safeParse({
    name: formData.get("name"),
    role: formData.get("role"),
    aliases: formString(formData, "aliases"),
    imageUrl: formString(formData, "imageUrl"),
    appearance: formString(formData, "appearance"),
    personality: formString(formData, "personality"),
    backstory: formString(formData, "backstory"),
    notes: formString(formData, "notes"),
  })
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the fields and try again." }
  const d = parsed.data
  return {
    ok: true,
    fields: {
      name: d.name,
      role: d.role,
      aliases: splitList(d.aliases),
      imageUrl: d.imageUrl ?? "",
      appearance: d.appearance ?? "",
      personality: d.personality ?? "",
      backstory: d.backstory ?? "",
      notes: d.notes ?? "",
    },
  }
}

export async function updateCharacterAction(
  projectId: string,
  characterId: string,
  _prevState: UpdateCharacterState,
  formData: FormData
): Promise<UpdateCharacterState> {
  const parsed = parse(formData)
  if (!parsed.ok) return { error: parsed.error }
  return (await updateCharacter(projectId, characterId, parsed.fields)) ? { success: true } : { error: TRASHED_PROJECT_ERROR }
}

/**
 * Creates the record from the blank "new" form. Nothing exists until this
 * runs, so opening the form and walking away leaves no stray record.
 */
export async function createCharacterFromFormAction(
  projectId: string,
  _prevState: UpdateCharacterState,
  formData: FormData
): Promise<UpdateCharacterState> {
  const parsed = parse(formData)
  if (!parsed.ok) return { error: parsed.error }
  const id = await createCharacter(projectId, parsed.fields)
  if (!id) return { error: TRASHED_PROJECT_ERROR }
  return { redirectTo: `/projects/${projectId}/characters/${id}` }
}
