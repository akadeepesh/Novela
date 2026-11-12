"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeftIcon } from "@phosphor-icons/react/dist/ssr"
import {
  PageShell,
  PageShellHeader,
  PageShellTitle,
} from "@/components/layout/page-shell"
import { Badge } from "@/components/ui/badge"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { worldEntryTypeLabel } from "@/lib/world-config"
import { AppearsIn } from "@/components/project/appears-in"
import { WorldEntryForm } from "./world-entry-form"
import { DeleteWorldEntryButton } from "./delete-world-entry-button"
import { useProjectSection } from "@/components/project/project-context"
import { LoadingView, NotFoundView } from "@/components/store/status-views"
import { useWorldEntry, useChaptersMentioning } from "@/lib/store/hooks"

export default function Page() {
  const project = useProjectSection("world")
  const { entryId } = useParams<{ id: string; entryId: string }>()
  const projectId = project?.id ?? ""
  const entry = useWorldEntry(projectId, entryId)
  const mentionedIn = useChaptersMentioning(projectId, "world", entryId)
  if (!project) return <NotFoundView />
  const id = project.id
  if (entry === undefined) return <LoadingView />
  if (entry === null) return <NotFoundView backHref={`/projects/${id}/world`} backLabel="Back to World" />

  return (
    <PageShell width="prose">
      <title>{`${entry.name} — ${project.title}`}</title>
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

      <WorldEntryForm key={entry.id} entry={entry} />

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Appears in</CardTitle>
          <CardDescription>Chapters that @mention this entry.</CardDescription>
        </CardHeader>
        <CardContent>
          <AppearsIn projectId={id} projectType={project.type} chapters={mentionedIn ?? []} />
        </CardContent>
      </Card>
    </PageShell>
  )
}
