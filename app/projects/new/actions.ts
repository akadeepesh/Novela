"use server";

import { connectDB } from "@/lib/db";
import { Project } from "@/lib/models/project";
import { Chapter } from "@/lib/models/chapter";
import { requireUserId } from "@/lib/projects";
import {
  PROJECT_TYPES,
  getDefaultSections,
  sectionLabelSingular,
  type ProjectType,
} from "@/lib/project-config";
import { initialChapterContent } from "@/lib/script-scaffold";

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
}): Promise<{ projectId: string; chapterId: string } | { error: "title-required" }> {
  const userId = await requireUserId();

  const type = isProjectType(input.type) ? input.type : "novel";
  const title = input.title.trim().slice(0, 200);
  if (!title) return { error: "title-required" };
  const sections = getDefaultSections(type);

  await connectDB();
  const project = await Project.create({ ownerId: userId, title, type, sections });

  const chapterLabel = sectionLabelSingular("chapters", type);
  const chapter = await Chapter.create({
    projectId: project._id,
    ownerId: userId,
    title: `${chapterLabel} 1`,
    order: 0,
    content: initialChapterContent(type),
  });

  return { projectId: String(project._id), chapterId: String(chapter._id) };
}
