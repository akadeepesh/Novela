import { addSection } from "@/lib/store/projects"
import type { SectionId } from "@/lib/project-config"

/** Adds an optional section (Characters, World…) to a project's sidebar. */
export async function addProjectSectionAction(projectId: string, sectionId: string): Promise<{ ok: boolean }> {
  return { ok: await addSection(projectId, sectionId as SectionId) }
}
