import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeftIcon } from "@phosphor-icons/react/dist/ssr"
import { PageShell, PageShellHeader, PageShellTitle } from "@/components/layout/page-shell"
import { requireProjectSection } from "@/lib/require-project-section"
import type { SerializedPlotThread } from "@/lib/plot-threads"
import { PlotThreadForm } from "./[threadId]/plot-thread-form"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const project = await requireProjectSection(id, "plot")
  return { title: `New thread — ${project.title}` }
}

// A blank form. Nothing is saved until the person presses "Create thread".
export default async function NewPlotThreadPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  await requireProjectSection(id, "plot")
  const draft: SerializedPlotThread = { id: "", projectId: id, title: "", status: "planned", aliases: [], updatedAt: "", createdAt: "" }

  return (
    <PageShell width="prose">
      <Link
        href={`/projects/${id}/plot`}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-3.5" />
        Plot
      </Link>

      <PageShellHeader>
        <PageShellTitle>New thread</PageShellTitle>
      </PageShellHeader>

      <PlotThreadForm thread={draft} />
    </PageShell>
  )
}
