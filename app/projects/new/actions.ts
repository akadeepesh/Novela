"use server";

import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import { Project } from "@/lib/models/project";
import { requireUserId } from "@/lib/projects";
import { getLimit, keepWithinLimit } from "@/lib/entitlements";
import { limitMessage } from "@/lib/plans";
import {
  PROJECT_TYPES,
  getDefaultSections,
  type ProjectType,
} from "@/lib/project-config";

const TYPE_VALUES = PROJECT_TYPES.map((t) => t.value) as ProjectType[];

function isProjectType(value: unknown): value is ProjectType {
  return typeof value === "string" && (TYPE_VALUES as string[]).includes(value);
}

/**
 * Deliberately minimal: two inputs. A title is required — a blank one used to
 * silently create an "Untitled Novel" (plus a chapter), so people exploring the
 * screen ended up with books they never meant to start. Genre and synopsis are
 * edited later on the overview page; extra sections (Characters/World/Plot…)
 * are added from the sidebar. Returns ids rather than redirecting so the
 * client can animate before navigating.
 */
export async function createProjectAction(input: {
  title: string;
  type: string;
}): Promise<
  { projectId: string } | { error: "title-required" } | { error: "limit-reached"; message: string }
> {
  const userId = await requireUserId();

  const type = isProjectType(input.type) ? input.type : "novel";
  const title = input.title.trim().slice(0, 200);
  if (!title) return { error: "title-required" };
  const sections = getDefaultSections(type);

  await connectDB();
  const { plan, limit } = await getLimit(userId, "projects");
  const limited = { error: "limit-reached" as const, message: limitMessage("projects", plan) };
  const active = { ownerId: userId, deletedAt: null };
  if ((await Project.countDocuments(active)) >= limit) return limited;
  const project = await Project.create({ ownerId: userId, title, type, sections });
  if (!(await keepWithinLimit(Project, active, project._id, limit))) return limited;

  revalidatePath("/dashboard");

  return { projectId: String(project._id) };
}
