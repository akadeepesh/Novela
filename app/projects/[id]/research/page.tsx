import type { Metadata } from "next"
import {
  PageShell,
  PageShellHeader,
  PageShellTitle,
  PageShellDescription,
} from "@/components/layout/page-shell"
import { requireProjectSection } from "@/lib/require-project-section"
import { listResearchEntriesForProject } from "@/lib/research-entries"
import { ResearchEntryGrid } from "./research-entry-grid"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const project = await requireProjectSection(id, "research")
  return { title: `Research — ${project.title}` }
}

export default async function ResearchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await requireProjectSection(id, "research")
  const entries = await listResearchEntriesForProject(id)

  return (
    <PageShell>
      <PageShellHeader>
        <PageShellTitle>Research</PageShellTitle>
        <PageShellDescription>
          A source board — paste a link and it turns into a reference card.
        </PageShellDescription>
      </PageShellHeader>

      <ResearchEntryGrid projectId={id} entries={entries} />
    </PageShell>
  )
}
