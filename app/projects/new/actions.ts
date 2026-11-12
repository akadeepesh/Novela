import { createProject } from "@/lib/store/projects"
import { PROJECT_TYPES, type ProjectType } from "@/lib/project-config"

const TYPE_VALUES = PROJECT_TYPES.map((t) => t.value) as ProjectType[]

function isProjectType(value: unknown): value is ProjectType {
  return typeof value === "string" && (TYPE_VALUES as string[]).includes(value)
}

/**
 * Deliberately minimal: a title and a type. A title is required, so people
 * exploring the screen don't end up with books they never meant to start.
 * Returns the id rather than navigating, so the caller can animate first.
 */
export async function createProjectAction(input: {
  title: string
  type: string
}): Promise<{ projectId: string } | { error: "title-required" }> {
  const type = isProjectType(input.type) ? input.type : "novel"
  const title = input.title.trim().slice(0, 200)
  if (!title) return { error: "title-required" }
  return { projectId: await createProject({ title, type }) }
}
