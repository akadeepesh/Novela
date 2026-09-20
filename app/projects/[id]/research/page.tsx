import type { Metadata } from "next"
import { PlusIcon } from "@phosphor-icons/react/dist/ssr"
import {
  PageShell,
  PageShellHeader,
  PageShellTitle,
  PageShellDescription,
} from "@/components/layout/page-shell"
import { EmptyState } from "@/components/ui/empty-state"
import { Button } from "@/components/ui/button"
import { SECTION_DEFS } from "@/lib/project-config"
import { requireProjectSection } from "@/lib/require-project-section"
import { listResearchEntriesForProject } from "@/lib/research-entries"
import { ResearchEntryGrid } from "./research-entry-grid"
import { createResearchEntryAction } from "./actions"

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
        <PageShellDescription>Reference material, links, and source notes.</PageShellDescription>
      </PageShellHeader>

      {entries.length === 0 ? (
        <EmptyState
          icon={SECTION_DEFS.research.icon}
          title="No research yet"
          description="Save the sources, links, and reference notes that back up your story."
          action={
            <form action={createResearchEntryAction.bind(null, id)}>
              <Button type="submit" size="sm">
                <PlusIcon />
                New entry
              </Button>
            </form>
          }
        />
      ) : (
        <ResearchEntryGrid projectId={id} entries={entries} />
      )}
    </PageShell>
  )
}
