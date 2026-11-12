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
import { WorldEntryGrid } from "./world-entry-grid"
import { useProjectSection } from "@/components/project/project-context"
import { NotFoundView } from "@/components/store/status-views"
import { useWorldEntries } from "@/lib/store/hooks"

export default function Page() {
  const project = useProjectSection("world")
  const entries = useWorldEntries(project?.id ?? "")
  if (!project) return <NotFoundView />
  const id = project.id

  return (
    <PageShell>
      <title>{`World — ${project.title}`}</title>
      <PageShellHeader>
        <PageShellTitle>World</PageShellTitle>
        <PageShellDescription>
          Places, factions, and everything else {project.title} takes place in.
        </PageShellDescription>
      </PageShellHeader>

      {entries === undefined ? null : entries.length === 0 ? (
        <EmptyState
          icon={SECTION_DEFS.world.icon}
          title="No world entries yet"
          description="Add the locations, factions, and items that make up your setting — you can fill in the details any time."
          action={
            <NewLinkButton href={`/projects/${id}/world/new`}>New entry</NewLinkButton>
          }
        />
      ) : (
        <WorldEntryGrid projectId={id} entries={entries} />
      )}
    </PageShell>
  )
}
