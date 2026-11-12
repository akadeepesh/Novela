"use client"

import {
  PageShell,
  PageShellHeader,
  PageShellTitle,
  PageShellDescription,
} from "@/components/layout/page-shell"
import { EmptyState } from "@/components/ui/empty-state"
import { NewLinkButton } from "@/components/ui/new-link-button"
import { SECTION_DEFS } from "@/lib/project-config"
import { PlotThreadList } from "./plot-thread-list"
import { useProjectSection } from "@/components/project/project-context"
import { NotFoundView } from "@/components/store/status-views"
import { usePlotThreads } from "@/lib/store/hooks"

export default function Page() {
  const project = useProjectSection("plot")
  const threads = usePlotThreads(project?.id ?? "")
  if (!project) return <NotFoundView />
  const id = project.id

  return (
    <PageShell>
      <title>{`Plot — ${project.title}`}</title>
      <PageShellHeader>
        <PageShellTitle>Plot</PageShellTitle>
        <PageShellDescription>The threads and arcs running through {project.title}.</PageShellDescription>
      </PageShellHeader>

      {threads === undefined ? null : threads.length === 0 ? (
        <EmptyState
          icon={SECTION_DEFS.plot.icon}
          title="No plot threads yet"
          description="Track the throughlines of your story — you can update their status as you write."
          action={
            <NewLinkButton href={`/projects/${id}/plot/new`}>New thread</NewLinkButton>
          }
        />
      ) : (
        <PlotThreadList projectId={id} threads={threads} />
      )}
    </PageShell>
  )
}
