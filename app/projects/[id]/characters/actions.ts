import { deleteCharacter } from "@/lib/store/bible"

export async function deleteCharacterAction(projectId: string, id: string): Promise<void> {
  await deleteCharacter(projectId, id)
}
