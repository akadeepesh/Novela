"use server";

import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import { Project } from "@/lib/models/project";
import { requireUserId } from "@/lib/projects";
import { safeAction, GENERIC_ERROR } from "@/lib/safe-action";
import { getLimit } from "@/lib/entitlements";
import { limitMessage } from "@/lib/plans";
import { findTrashedProject, purgeProject } from "@/lib/trash";

export type TrashResult = { ok: boolean; error?: string };

function refresh() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/trash");
}

/** Moves a project to the Trash. Nothing is deleted; it can be restored for 30 days. */
export const trashProjectAction = safeAction(
  "trashProjectAction",
  async (projectId: string): Promise<TrashResult> => {
    const userId = await requireUserId();
    await connectDB();
    const result = await Project.updateOne(
      { _id: projectId, ownerId: userId, deletedAt: null },
      { $set: { deletedAt: new Date() } },
      { timestamps: false }
    );
    if (result.matchedCount === 0) return { ok: false, error: "Couldn't find this project." };
    refresh();
    return { ok: true };
  },
  () => ({ ok: false, error: GENERIC_ERROR }),
  { ids: [0] }
);

export const restoreProjectAction = safeAction(
  "restoreProjectAction",
  async (projectId: string): Promise<TrashResult> => {
    const userId = await requireUserId();
    await connectDB();
    // Restoring counts as creating one: the account limit still applies.
    const { plan, limit } = await getLimit(userId, "projects");
    const limited = { ok: false, error: limitMessage("projects", plan) };
    const active = { ownerId: userId, deletedAt: null };
    if ((await Project.countDocuments(active)) >= limit) return limited;
    const previous = await Project.findOneAndUpdate(
      { _id: projectId, ownerId: userId, deletedAt: { $ne: null } },
      { $unset: { deletedAt: "" } },
      { timestamps: false, new: false, projection: "deletedAt" }
    ).lean<{ deletedAt: Date }>();
    if (!previous) return { ok: false, error: "Couldn't find this project in the Trash." };
    // Another create/restore may have landed at the same moment. If that put
    // the account over the limit, put this one back where it was.
    if ((await Project.countDocuments(active)) > limit) {
      await Project.updateOne(
        { _id: projectId, ownerId: userId },
        { $set: { deletedAt: previous.deletedAt } },
        { timestamps: false }
      );
      return limited;
    }
    refresh();
    return { ok: true };
  },
  () => ({ ok: false, error: GENERIC_ERROR }),
  { ids: [0] }
);

/** Permanently deletes a project that is already in the Trash. */
export const deleteProjectForeverAction = safeAction(
  "deleteProjectForeverAction",
  async (projectId: string): Promise<TrashResult> => {
    const userId = await requireUserId();
    const project = await findTrashedProject(projectId, userId);
    if (!project) return { ok: false, error: "Couldn't find this project in the Trash." };
    await purgeProject(project, userId);
    refresh();
    return { ok: true };
  },
  () => ({ ok: false, error: GENERIC_ERROR }),
  { ids: [0] }
);
