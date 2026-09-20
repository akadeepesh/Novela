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
import { listNotesForProject } from "@/lib/notes"
import { NoteGrid } from "./note-grid"
import { createNoteAction } from "./actions"

export default async function NotesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await requireProjectSection(id, "notes")
  const notes = await listNotesForProject(id)

  return (
    <PageShell>
      <PageShellHeader>
        <PageShellTitle>Notes</PageShellTitle>
        <PageShellDescription>A scratchpad for anything that doesn&apos;t belong anywhere else yet.</PageShellDescription>
      </PageShellHeader>

      {notes.length === 0 ? (
        <EmptyState
          icon={SECTION_DEFS.notes.icon}
          title="No notes yet"
          description="Jot down anything worth remembering — pin the important ones so they stay on top."
          action={
            <form action={createNoteAction.bind(null, id)}>
              <Button type="submit" size="sm">
                <PlusIcon />
                New note
              </Button>
            </form>
          }
        />
      ) : (
        <NoteGrid projectId={id} notes={notes} />
      )}
    </PageShell>
  )
}
