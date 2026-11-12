"use client"

import {
  PageShell,
  PageShellHeader,
  PageShellTitle,
  PageShellDescription,
} from "@/components/layout/page-shell"
import { NoteGrid } from "./note-grid"
import { useProjectSection } from "@/components/project/project-context"
import { NotFoundView } from "@/components/store/status-views"
import { useNotes } from "@/lib/store/hooks"

export default function Page() {
  const project = useProjectSection("notes")
  const notes = useNotes(project?.id ?? "")
  if (!project) return <NotFoundView />
  const id = project.id

  return (
    <PageShell>
      <title>{`Notes — ${project.title}`}</title>
      <PageShellHeader>
        <PageShellTitle>Notes</PageShellTitle>
        <PageShellDescription>
          A scratchpad for anything that doesn&apos;t belong anywhere else yet.
        </PageShellDescription>
      </PageShellHeader>

      {notes === undefined ? null : <NoteGrid projectId={id} notes={notes} />}
    </PageShell>
  )
}
