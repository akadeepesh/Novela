"use client"

import { useProject, useSearchIndex } from "@/lib/store/hooks"
import { LoadingView, NotFoundView } from "@/components/store/status-views"
import { ProjectProvider } from "./project-context"
import { ProjectShell } from "./project-shell"

/** Loads a project from the local database and wraps its pages in the sidebar shell. */
export function ProjectLoader({
  projectId,
  defaultCollapsed,
  children,
}: {
  projectId: string
  defaultCollapsed: boolean
  children: React.ReactNode
}) {
  const project = useProject(projectId)
  const searchItems = useSearchIndex(projectId)

  if (project === undefined) return <LoadingView />
  if (project === null) return <NotFoundView />

  return (
    <ProjectProvider value={project}>
      <ProjectShell project={project} searchItems={searchItems ?? []} defaultCollapsed={defaultCollapsed}>
        {children}
      </ProjectShell>
    </ProjectProvider>
  )
}
