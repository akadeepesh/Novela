import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeftIcon } from "@phosphor-icons/react/dist/ssr"
import {
  PageShell,
  PageShellHeader,
  PageShellTitle,
} from "@/components/layout/page-shell"
import { Badge } from "@/components/ui/badge"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { requireProjectSection } from "@/lib/require-project-section"
import { requireWorldEntry } from "@/lib/world-entries"
import { worldEntryTypeLabel } from "@/lib/world-config"
import { listChaptersMentioning } from "@/lib/mentions"
import { AppearsIn } from "@/components/project/appears-in"
import { WorldEntryForm } from "./world-entry-form"
import { DeleteWorldEntryButton } from "./delete-world-entry-button"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; entryId: string }>
}): Promise<Metadata> {
  const { id, entryId } = await params
  const project = await requireProjectSection(id, "world")
  const entry = await requireWorldEntry(id, entryId)
  return { title: `${entry.name} — ${project.title}` }
}

export default async function WorldEntryDetailPage({
  params,
}: {
  params: Promise<{ id: string; entryId: string }>
}) {
  const { id, entryId } = await params
  const project = await requireProjectSection(id, "world")
  const entry = await requireWorldEntry(id, entryId)
  const mentionedIn = await listChaptersMentioning(id, "world", entryId)

  return (
    <PageShell width="prose">
      <Link
        href={`/projects/${id}/world`}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-3.5" />
        World
      </Link>

      <PageShellHeader className="flex-row items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{worldEntryTypeLabel(entry.type)}</Badge>
          </div>
          <PageShellTitle>{entry.name}</PageShellTitle>
        </div>
        <DeleteWorldEntryButton projectId={id} entryId={entryId} name={entry.name} />
      </PageShellHeader>

      <WorldEntryForm entry={entry} />

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Appears in</CardTitle>
          <CardDescription>Chapters that @mention this entry.</CardDescription>
        </CardHeader>
        <CardContent>
          <AppearsIn projectId={id} projectType={project.type} chapters={mentionedIn} />
        </CardContent>
      </Card>
    </PageShell>
  )
}
