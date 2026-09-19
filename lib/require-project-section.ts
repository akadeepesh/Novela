import { notFound } from "next/navigation";
import { requireProject, type SerializedProject } from "@/lib/projects";
import type { SectionId } from "@/lib/project-config";

/**
 * Loads the project (ownership-checked) and 404s if the requested section
 * isn't part of this project's structure — e.g. visiting /plot on a poetry
 * project that opted out of the story bible.
 */
export async function requireProjectSection(
  id: string,
  section: SectionId
): Promise<SerializedProject> {
  const project = await requireProject(id);
  if (!project.sections.includes(section)) notFound();
  return project;
}
