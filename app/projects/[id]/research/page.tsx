"use client"

import {
  PageShell,
  PageShellHeader,
  PageShellTitle,
  PageShellDescription,
} from "@/components/layout/page-shell"
import { ResearchEntryGrid } from "./research-entry-grid"
import { useProjectSection } from "@/components/project/project-context"
import { NotFoundView } from "@/components/store/status-views"
import { useResearchEntries } from "@/lib/store/hooks"

export default function Page() {
  const project = useProjectSection("research")
  const entries = useResearchEntries(project?.id ?? "")
  if (!project) return <NotFoundView />
  const id = project.id

  return (
    <PageShell>
      <title>{`Research — ${project.title}`}</title>
      <PageShellHeader>
        <PageShellTitle>Research</PageShellTitle>
        <PageShellDescription>
          A source board — paste a link and it turns into a reference card.
        </PageShellDescription>
      </PageShellHeader>

      {entries === undefined ? null : <ResearchEntryGrid projectId={id} entries={entries} />}
    </PageShell>
  )
}
