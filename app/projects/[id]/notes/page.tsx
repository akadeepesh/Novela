import type { Metadata } from "next"
import {
  PageShell,
  PageShellHeader,
  PageShellTitle,
  PageShellDescription,
} from "@/components/layout/page-shell"
import { requireProjectSection } from "@/lib/require-project-section"
import { listNotesForProject } from "@/lib/notes"
import { NoteGrid } from "./note-grid"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const project = await requireProjectSection(id, "notes")
  return { title: `Notes — ${project.title}` }
}

export default async function NotesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await requireProjectSection(id, "notes")
  const notes = await listNotesForProject(id)

  return (
    <PageShell>
      <PageShellHeader>
        <PageShellTitle>Notes</PageShellTitle>
        <PageShellDescription>
          A scratchpad for anything that doesn&apos;t belong anywhere else yet.
        </PageShellDescription>
      </PageShellHeader>

      <NoteGrid projectId={id} notes={notes} />
    </PageShell>
  )
}
