"use client"

import { createContext, useContext } from "react"
import type { SerializedProject } from "@/lib/store/projects"
import type { SectionId } from "@/lib/project-config"

const ProjectContext = createContext<SerializedProject | null>(null)

export const ProjectProvider = ProjectContext.Provider

/** The project of the current /projects/[id] page, loaded once by the project layout. */
export function useCurrentProject(): SerializedProject {
  const project = useContext(ProjectContext)
  if (!project) throw new Error("useCurrentProject must be used inside the project layout")
  return project
}

/**
 * The current project if it has `section` in its sidebar, else null (render
 * "not found"), e.g. visiting /plot on a poetry project without a story bible.
 */
export function useProjectSection(section: SectionId): SerializedProject | null {
  const project = useCurrentProject()
  return project.sections.includes(section) ? project : null
}
