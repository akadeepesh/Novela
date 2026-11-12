"use client"

import Link from "next/link"
import { ArrowLeftIcon } from "@phosphor-icons/react/dist/ssr"
import { PageShell, PageShellHeader, PageShellTitle } from "@/components/layout/page-shell"
import { CharacterForm } from "../[characterId]/character-form"
import type { SerializedCharacter } from "@/lib/store/bible"
import { useProjectSection } from "@/components/project/project-context"
import { NotFoundView } from "@/components/store/status-views"

// A blank form. Nothing is saved until the person presses Create.
export default function Page() {
  const project = useProjectSection("characters")
  if (!project) return <NotFoundView />
  const id = project.id
  const draft: SerializedCharacter = { id: "", projectId: id, name: "", role: "supporting", aliases: [], createdAt: "", updatedAt: "" }

  return (
    <PageShell width="prose">
      <title>{`New character — ${project.title}`}</title>
      <Link
        href={`/projects/${id}/characters`}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-3.5" />
        Characters
      </Link>

      <PageShellHeader>
        <PageShellTitle>New character</PageShellTitle>
      </PageShellHeader>

      <CharacterForm character={draft} />
    </PageShell>
  )
}
