import { deletePlotThread } from "@/lib/store/bible"

export async function deletePlotThreadAction(projectId: string, id: string): Promise<void> {
  await deletePlotThread(projectId, id)
}
