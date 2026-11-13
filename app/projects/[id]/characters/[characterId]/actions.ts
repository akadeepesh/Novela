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
  eyeColor: z.string().trim().max(60).optional(),
  hairColor: z.string().trim().max(60).optional(),
  birthYear: z
    .string()
    .trim()
    .regex(/^(-?\d{1,4})?$/, "Birth year should be a year, like 1990")
    .optional(),
  pronouns: z.enum(["none", "she", "he", "they"]).optional(),
  status: z.enum(["none", "alive", "dead", "missing"]).optional(),
  statusChapterId: z.string().max(100).optional(),
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
    eyeColor: formString(formData, "eyeColor"),
    hairColor: formString(formData, "hairColor"),
    birthYear: formString(formData, "birthYear"),
    pronouns: formString(formData, "pronouns") || undefined,
    status: formString(formData, "status") || undefined,
    statusChapterId: formString(formData, "statusChapterId"),
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
      eyeColor: d.eyeColor ?? "",
      hairColor: d.hairColor ?? "",
      birthYear: d.birthYear ? Number(d.birthYear) : undefined,
      pronouns: !d.pronouns || d.pronouns === "none" ? "" : d.pronouns,
      status: !d.status || d.status === "none" ? "" : d.status,
      // The chapter only matters for dead or missing.
      statusChapterId:
        d.status === "dead" || d.status === "missing" ? (d.statusChapterId && d.statusChapterId !== "none" ? d.statusChapterId : undefined) : undefined,
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
