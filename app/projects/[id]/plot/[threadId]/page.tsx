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
import { plotStatusLabel } from "@/lib/plot-config"
import { AppearsIn } from "@/components/project/appears-in"
import { PlotThreadForm } from "./plot-thread-form"
import { DeletePlotThreadButton } from "./delete-plot-thread-button"
import { useProjectSection } from "@/components/project/project-context"
import { LoadingView, NotFoundView } from "@/components/store/status-views"
import { usePlotThread, useChaptersMentioning } from "@/lib/store/hooks"

export default function Page() {
  const project = useProjectSection("plot")
  const { threadId } = useParams<{ id: string; threadId: string }>()
  const projectId = project?.id ?? ""
  const thread = usePlotThread(projectId, threadId)
  const mentionedIn = useChaptersMentioning(projectId, "plot", threadId)
  if (!project) return <NotFoundView />
  const id = project.id
  if (thread === undefined) return <LoadingView />
  if (thread === null) return <NotFoundView backHref={`/projects/${id}/plot`} backLabel="Back to Plot" />

  return (
    <PageShell width="prose">
      <title>{`${thread.title} — ${project.title}`}</title>
      <Link
        href={`/projects/${id}/plot`}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-3.5" />
        Plot
      </Link>

      <PageShellHeader className="flex-row items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{plotStatusLabel(thread.status)}</Badge>
          </div>
          <PageShellTitle>{thread.title}</PageShellTitle>
        </div>
        <DeletePlotThreadButton projectId={id} threadId={threadId} title={thread.title} />
      </PageShellHeader>

      <PlotThreadForm key={thread.id} thread={thread} />

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Appears in</CardTitle>
          <CardDescription>Chapters that @mention this thread.</CardDescription>
        </CardHeader>
        <CardContent>
          <AppearsIn projectId={id} projectType={project.type} chapters={mentionedIn ?? []} />
        </CardContent>
      </Card>
    </PageShell>
  )
}
