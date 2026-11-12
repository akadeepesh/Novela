import { deleteProjectForever, restoreProject, trashProject } from "@/lib/store/projects"

export type TrashResult = { ok: boolean; error?: string }

/** Moves a project to the Trash. Nothing is deleted; it can be restored for 30 days. */
export async function trashProjectAction(projectId: string): Promise<TrashResult> {
  return (await trashProject(projectId)) ? { ok: true } : { ok: false, error: "Couldn't find this project." }
}

export async function restoreProjectAction(projectId: string): Promise<TrashResult> {
  return (await restoreProject(projectId))
    ? { ok: true }
    : { ok: false, error: "Couldn't find this project in the Trash." }
}

/** Permanently deletes a project that is already in the Trash. */
export async function deleteProjectForeverAction(projectId: string): Promise<TrashResult> {
  return (await deleteProjectForever(projectId))
    ? { ok: true }
    : { ok: false, error: "Couldn't find this project in the Trash." }
}
