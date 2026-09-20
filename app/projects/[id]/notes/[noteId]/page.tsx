import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeftIcon, PushPinIcon } from "@phosphor-icons/react/dist/ssr"
import {
  PageShell,
  PageShellHeader,
  PageShellTitle,
} from "@/components/layout/page-shell"
import { requireProjectSection } from "@/lib/require-project-section"
import { requireNote } from "@/lib/notes"
import { NoteForm } from "./note-form"
import { DeleteNoteButton } from "./delete-note-button"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; noteId: string }>
}): Promise<Metadata> {
  const { id, noteId } = await params
  const project = await requireProjectSection(id, "notes")
  const note = await requireNote(id, noteId)
  return { title: `${note.title} — ${project.title}` }
}

export default async function NoteDetailPage({
  params,
}: {
  params: Promise<{ id: string; noteId: string }>
}) {
  const { id, noteId } = await params
  await requireProjectSection(id, "notes")
  const note = await requireNote(id, noteId)

  return (
    <PageShell width="prose">
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
