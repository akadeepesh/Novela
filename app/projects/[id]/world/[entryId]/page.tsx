import Link from "next/link"
import { ArrowLeftIcon } from "@phosphor-icons/react/dist/ssr"
import {
  PageShell,
  PageShellHeader,
  PageShellTitle,
} from "@/components/layout/page-shell"
import { Badge } from "@/components/ui/badge"
import { requireProjectSection } from "@/lib/require-project-section"
import { requireWorldEntry } from "@/lib/world-entries"
import { worldEntryTypeLabel } from "@/lib/world-config"
import { WorldEntryForm } from "./world-entry-form"
import { DeleteWorldEntryButton } from "./delete-world-entry-button"

export default async function WorldEntryDetailPage({
  params,
}: {
  params: Promise<{ id: string; entryId: string }>
}) {
  const { id, entryId } = await params
  await requireProjectSection(id, "world")
  const entry = await requireWorldEntry(id, entryId)

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
    </PageShell>
  )
}
