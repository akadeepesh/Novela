"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeftIcon, ArrowSquareOutIcon } from "@phosphor-icons/react/dist/ssr"
import {
  PageShell,
  PageShellHeader,
  PageShellTitle,
} from "@/components/layout/page-shell"
import { Badge } from "@/components/ui/badge"
import { researchEntryTypeLabel } from "@/lib/research-config"
import { ResearchEntryForm } from "./research-entry-form"
import { DeleteResearchEntryButton } from "./delete-research-entry-button"
import { useProjectSection } from "@/components/project/project-context"
import { LoadingView, NotFoundView } from "@/components/store/status-views"
import { useResearchEntry } from "@/lib/store/hooks"

export default function Page() {
  const project = useProjectSection("research")
  const { entryId } = useParams<{ id: string; entryId: string }>()
  const entry = useResearchEntry(project?.id ?? "", entryId)
  if (!project) return <NotFoundView />
  const id = project.id
  if (entry === undefined) return <LoadingView />
  if (entry === null) return <NotFoundView backHref={`/projects/${id}/research`} backLabel="Back to Research" />

  return (
    <PageShell width="prose">
      <title>{`${entry.title} — ${project.title}`}</title>
      <Link
        href={`/projects/${id}/research`}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-3.5" />
        Research
      </Link>

      <PageShellHeader className="flex-row items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{researchEntryTypeLabel(entry.type)}</Badge>
            {entry.type !== "note" && entry.url ? (
              <a
                href={entry.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
              >
                Open <ArrowSquareOutIcon className="size-3" />
              </a>
            ) : null}
          </div>
          <PageShellTitle>{entry.title}</PageShellTitle>
        </div>
        <DeleteResearchEntryButton projectId={id} entryId={entryId} title={entry.title} />
      </PageShellHeader>

      <ResearchEntryForm entry={entry} />
    </PageShell>
  )
}
