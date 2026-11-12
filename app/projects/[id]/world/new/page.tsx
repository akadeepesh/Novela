"use client"

import Link from "next/link"
import { ArrowLeftIcon } from "@phosphor-icons/react/dist/ssr"
import { PageShell, PageShellHeader, PageShellTitle } from "@/components/layout/page-shell"
import { WorldEntryForm } from "../[entryId]/world-entry-form"
import type { SerializedWorldEntry } from "@/lib/store/bible"
import { useProjectSection } from "@/components/project/project-context"
import { NotFoundView } from "@/components/store/status-views"

// A blank form. Nothing is saved until the person presses Create.
export default function Page() {
  const project = useProjectSection("world")
  if (!project) return <NotFoundView />
  const id = project.id
  const draft: SerializedWorldEntry = { id: "", projectId: id, name: "", type: "location", aliases: [], createdAt: "", updatedAt: "" }

  return (
    <PageShell width="prose">
      <title>{`New world entry — ${project.title}`}</title>
      <Link
        href={`/projects/${id}/world`}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-3.5" />
        World
      </Link>

      <PageShellHeader>
        <PageShellTitle>New entry</PageShellTitle>
      </PageShellHeader>

      <WorldEntryForm entry={draft} />
    </PageShell>
  )
}
