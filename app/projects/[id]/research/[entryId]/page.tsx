import Link from "next/link"
import { ArrowLeftIcon, ArrowSquareOutIcon } from "@phosphor-icons/react/dist/ssr"
import {
  PageShell,
  PageShellHeader,
  PageShellTitle,
} from "@/components/layout/page-shell"
import { Badge } from "@/components/ui/badge"
import { requireProjectSection } from "@/lib/require-project-section"
import { requireResearchEntry } from "@/lib/research-entries"
import { researchEntryTypeLabel } from "@/lib/research-config"
import { ResearchEntryForm } from "./research-entry-form"
import { DeleteResearchEntryButton } from "./delete-research-entry-button"

export default async function ResearchEntryDetailPage({
  params,
}: {
  params: Promise<{ id: string; entryId: string }>
}) {
  const { id, entryId } = await params
  await requireProjectSection(id, "research")
  const entry = await requireResearchEntry(id, entryId)

  return (
    <PageShell width="prose">
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
