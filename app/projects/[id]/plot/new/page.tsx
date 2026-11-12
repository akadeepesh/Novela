"use client"

import Link from "next/link"
import { ArrowLeftIcon } from "@phosphor-icons/react/dist/ssr"
import { PageShell, PageShellHeader, PageShellTitle } from "@/components/layout/page-shell"
import { PlotThreadForm } from "../[threadId]/plot-thread-form"
import type { SerializedPlotThread } from "@/lib/store/bible"
import { useProjectSection } from "@/components/project/project-context"
import { NotFoundView } from "@/components/store/status-views"

// A blank form. Nothing is saved until the person presses Create.
export default function Page() {
  const project = useProjectSection("plot")
  if (!project) return <NotFoundView />
  const id = project.id
  const draft: SerializedPlotThread = { id: "", projectId: id, title: "", status: "planned", aliases: [], updatedAt: "", createdAt: "" }

  return (
    <PageShell width="prose">
      <title>{`New plot thread — ${project.title}`}</title>
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
