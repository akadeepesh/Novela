"use client"

import {
  PageShell,
  PageShellHeader,
  PageShellTitle,
  PageShellDescription,
} from "@/components/layout/page-shell"
import { EmptyState } from "@/components/ui/empty-state"
import { NewLinkButton } from "@/components/ui/new-link-button"
import { SECTION_DEFS } from "@/lib/project-config"
import { CharacterGrid } from "./character-grid"
import { useProjectSection } from "@/components/project/project-context"
import { NotFoundView } from "@/components/store/status-views"
import { useCharacters } from "@/lib/store/hooks"

export default function Page() {
  const project = useProjectSection("characters")
  const characters = useCharacters(project?.id ?? "")
  if (!project) return <NotFoundView />
  const id = project.id

  return (
    <PageShell>
      <title>{`Characters — ${project.title}`}</title>
      <PageShellHeader>
        <PageShellTitle>Characters</PageShellTitle>
        <PageShellDescription>Everyone who appears in {project.title}.</PageShellDescription>
      </PageShellHeader>

      {characters === undefined ? null : characters.length === 0 ? (
        <EmptyState
          icon={SECTION_DEFS.characters.icon}
          title="No characters yet"
          description="Add the people (or otherwise) who populate your story — you can fill in the details any time."
          action={
            <NewLinkButton href={`/projects/${id}/characters/new`}>New character</NewLinkButton>
          }
        />
      ) : (
        <CharacterGrid projectId={id} characters={characters} />
      )}
    </PageShell>
  )
}
