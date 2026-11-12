"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeftIcon, PushPinIcon } from "@phosphor-icons/react/dist/ssr"
import {
  PageShell,
  PageShellHeader,
  PageShellTitle,
} from "@/components/layout/page-shell"
import { NoteForm } from "./note-form"
import { DeleteNoteButton } from "./delete-note-button"
import { useProjectSection } from "@/components/project/project-context"
import { LoadingView, NotFoundView } from "@/components/store/status-views"
import { useNote } from "@/lib/store/hooks"

export default function Page() {
  const project = useProjectSection("notes")
  const { noteId } = useParams<{ id: string; noteId: string }>()
  const note = useNote(project?.id ?? "", noteId)
  if (!project) return <NotFoundView />
  const id = project.id
  if (note === undefined) return <LoadingView />
  if (note === null) return <NotFoundView backHref={`/projects/${id}/notes`} backLabel="Back to Notes" />

  return (
    <PageShell width="prose">
      <title>{`${note.title} — ${project.title}`}</title>
      <Link
        href={`/projects/${id}/notes`}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-3.5" />
        Notes
      </Link>

      <PageShellHeader className="flex-row items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          {note.pinned ? (
            <PushPinIcon className="size-4 text-primary" weight="fill" />
          ) : null}
          <PageShellTitle>{note.title}</PageShellTitle>
        </div>
        <DeleteNoteButton projectId={id} noteId={noteId} title={note.title} />
      </PageShellHeader>

      <NoteForm note={note} />
    </PageShell>
  )
}
