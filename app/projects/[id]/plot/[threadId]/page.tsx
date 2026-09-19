import Link from "next/link"
import { ArrowLeftIcon } from "@phosphor-icons/react/dist/ssr"
import {
  PageShell,
  PageShellHeader,
  PageShellTitle,
} from "@/components/layout/page-shell"
import { Badge } from "@/components/ui/badge"
import { requireProjectSection } from "@/lib/require-project-section"
import { requirePlotThread } from "@/lib/plot-threads"
import { plotStatusLabel } from "@/lib/plot-config"
import { PlotThreadForm } from "./plot-thread-form"
import { DeletePlotThreadButton } from "./delete-plot-thread-button"

export default async function PlotThreadDetailPage({
  params,
}: {
  params: Promise<{ id: string; threadId: string }>
}) {
  const { id, threadId } = await params
  await requireProjectSection(id, "plot")
  const thread = await requirePlotThread(id, threadId)

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
    </PageShell>
  )
}
