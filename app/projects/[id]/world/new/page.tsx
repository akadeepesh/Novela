import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeftIcon } from "@phosphor-icons/react/dist/ssr"
import { PageShell, PageShellHeader, PageShellTitle } from "@/components/layout/page-shell"
import { requireProjectSection } from "@/lib/require-project-section"
import type { SerializedWorldEntry } from "@/lib/world-entries"
import { WorldEntryForm } from "./[entryId]/world-entry-form"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const project = await requireProjectSection(id, "world")
  return { title: `New entry — ${project.title}` }
}

// A blank form. Nothing is saved until the person presses "Create entry".
export default async function NewWorldEntryPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  await requireProjectSection(id, "world")
  const draft: SerializedWorldEntry = { id: "", projectId: id, name: "", type: "location", aliases: [], createdAt: "", updatedAt: "" }

  return (
    <PageShell width="prose">
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
