import type { Metadata } from "next"
import {
  PageShell,
  PageShellHeader,
  PageShellTitle,
  PageShellDescription,
} from "@/components/layout/page-shell"
import { EmptyState } from "@/components/ui/empty-state"
import { CreateButton } from "@/components/ui/create-button"
import { SECTION_DEFS } from "@/lib/project-config"
import { requireProjectSection } from "@/lib/require-project-section"
import { listCharactersForProject } from "@/lib/characters"
import { CharacterGrid } from "./character-grid"
import { createCharacterAction } from "./actions"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const project = await requireProjectSection(id, "characters")
  return { title: `Characters — ${project.title}` }
}

export default async function CharactersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const project = await requireProjectSection(id, "characters")
  const characters = await listCharactersForProject(id)

  return (
    <PageShell>
      <PageShellHeader>
        <PageShellTitle>Characters</PageShellTitle>
        <PageShellDescription>Everyone who appears in {project.title}.</PageShellDescription>
      </PageShellHeader>

      {characters.length === 0 ? (
        <EmptyState
          icon={SECTION_DEFS.characters.icon}
          title="No characters yet"
          description="Add the people (or otherwise) who populate your story — you can fill in the details any time."
          action={
            <CreateButton action={createCharacterAction.bind(null, id)}>New character</CreateButton>
          }
        />
      ) : (
        <CharacterGrid projectId={id} characters={characters} />
      )}
    </PageShell>
  )
}
