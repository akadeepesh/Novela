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
import { listWorldEntriesForProject } from "@/lib/world-entries"
import { WorldEntryGrid } from "./world-entry-grid"
import { createWorldEntryAction } from "./actions"

export default async function WorldPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const project = await requireProjectSection(id, "world")
  const entries = await listWorldEntriesForProject(id)

  return (
    <PageShell>
      <PageShellHeader>
        <PageShellTitle>World</PageShellTitle>
        <PageShellDescription>
          Places, factions, and everything else {project.title} takes place in.
        </PageShellDescription>
      </PageShellHeader>

      {entries.length === 0 ? (
        <EmptyState
          icon={SECTION_DEFS.world.icon}
          title="No world entries yet"
          description="Add the locations, factions, and items that make up your setting — you can fill in the details any time."
          action={
            <form action={createWorldEntryAction.bind(null, id)}>
              <Button type="submit" size="sm">
                <PlusIcon />
                New entry
              </Button>
            </form>
          }
        />
      ) : (
        <WorldEntryGrid projectId={id} entries={entries} />
      )}
    </PageShell>
  )
}
