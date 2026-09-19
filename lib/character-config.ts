export const CHARACTER_ROLES = [
  { value: "protagonist", label: "Protagonist" },
  { value: "antagonist", label: "Antagonist" },
  { value: "supporting", label: "Supporting" },
  { value: "minor", label: "Minor" },
] as const

export type CharacterRole = (typeof CHARACTER_ROLES)[number]["value"]

export function characterRoleLabel(role: CharacterRole): string {
  return CHARACTER_ROLES.find((r) => r.value === role)?.label ?? role
}
