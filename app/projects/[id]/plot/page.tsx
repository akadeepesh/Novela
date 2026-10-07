import type { Metadata } from "next"
import {
  PageShell,
  PageShellHeader,
  PageShellTitle,
  PageShellDescription,
} from "@/components/layout/page-shell"
import { EmptyState } from "@/components/ui/empty-state"
import { NewLinkButton } from "@/components/ui/new-link-button"
import { SECTION_DEFS } from "@/lib/project-config"
import { requireProjectSection } from "@/lib/require-project-section"
import { listPlotThreadsForProject } from "@/lib/plot-threads"
import { PlotThreadList } from "./plot-thread-list"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const project = await requireProjectSection(id, "plot")
  return { title: `Plot — ${project.title}` }
}

export default async function PlotPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const project = await requireProjectSection(id, "plot")
  const threads = await listPlotThreadsForProject(id)

  return (
    <PageShell>
      <PageShellHeader>
        <PageShellTitle>Plot</PageShellTitle>
        <PageShellDescription>The threads and arcs running through {project.title}.</PageShellDescription>
      </PageShellHeader>

      {threads.length === 0 ? (
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
