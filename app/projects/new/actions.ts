"use server";

import { connectDB } from "@/lib/db";
import { Project } from "@/lib/models/project";
import { requireUserId } from "@/lib/projects";
import { LIMITS, limitMessage } from "@/lib/limits";
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
}): Promise<{ projectId: string } | { error: "title-required" | "limit-reached" }> {
  const userId = await requireUserId();

  const type = isProjectType(input.type) ? input.type : "novel";
  const title = input.title.trim().slice(0, 200);
  if (!title) return { error: "title-required" };
  const sections = getDefaultSections(type);

  await connectDB();
  if ((await Project.countDocuments({ ownerId: userId })) >= LIMITS.projects) {
    return { error: "limit-reached" };
  }
  const project = await Project.create({ ownerId: userId, title, type, sections });

  return { projectId: String(project._id) };
}
