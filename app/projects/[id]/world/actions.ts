import { deleteWorldEntry } from "@/lib/store/bible"

export async function deleteWorldEntryAction(projectId: string, id: string): Promise<void> {
  await deleteWorldEntry(projectId, id)
}
