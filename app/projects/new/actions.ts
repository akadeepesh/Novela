"use server";

import { redirect } from "next/navigation";
import { connectDB } from "@/lib/db";
import { Project } from "@/lib/models/project";
import { Chapter } from "@/lib/models/chapter";
import { requireUserId } from "@/lib/projects";
import {
  PROJECT_TYPES,
  getDefaultSections,
  projectTypeLabel,
  sectionLabelSingular,
  type ProjectType,
} from "@/lib/project-config";

const TYPE_VALUES = PROJECT_TYPES.map((t) => t.value) as ProjectType[];

function isProjectType(value: unknown): value is ProjectType {
  return typeof value === "string" && (TYPE_VALUES as string[]).includes(value);
}

/**
 * Deliberately minimal: two inputs, no validation errors surfaced to the
 * user (a blank title just becomes "Untitled X" — there's no wrong answer
 * here). The story bible (Characters/World/Plot) is no longer a creation-
 * time question; every project can add those sections later from the
 * sidebar's "+ Add section" instead.
 */
export async function createProjectAction(input: { title: string; type: string }) {
  const userId = await requireUserId();

  const type = isProjectType(input.type) ? input.type : "novel";
  const title = input.title.trim().slice(0, 200) || `Untitled ${projectTypeLabel(type)}`;
  const sections = getDefaultSections(type, false);

  await connectDB();
  const project = await Project.create({ ownerId: userId, title, type, sections });

  const chapterLabel = sectionLabelSingular("chapters", type);
  const chapter = await Chapter.create({
    projectId: project._id,
    ownerId: userId,
    title: `${chapterLabel} 1`,
    order: 0,
  });

  redirect(`/projects/${project._id}/chapters/${chapter._id}`);
}
