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
import { requirePlotThread } from "@/lib/plot-threads"
import { plotStatusLabel } from "@/lib/plot-config"
import { listChaptersMentioning } from "@/lib/mentions"
import { AppearsIn } from "@/components/project/appears-in"
import { PlotThreadForm } from "./plot-thread-form"
import { DeletePlotThreadButton } from "./delete-plot-thread-button"

export default async function PlotThreadDetailPage({
  params,
}: {
  params: Promise<{ id: string; threadId: string }>
}) {
  const { id, threadId } = await params
  const project = await requireProjectSection(id, "plot")
  const thread = await requirePlotThread(id, threadId)
  const mentionedIn = await listChaptersMentioning(id, "plot", threadId)

  return (
    <PageShell width="prose">
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

      <PlotThreadForm thread={thread} />

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Appears in</CardTitle>
          <CardDescription>Chapters that @mention this thread.</CardDescription>
        </CardHeader>
        <CardContent>
          <AppearsIn projectId={id} projectType={project.type} chapters={mentionedIn} />
        </CardContent>
      </Card>
    </PageShell>
  )
}
