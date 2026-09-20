import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeftIcon } from "@phosphor-icons/react/dist/ssr"
import {
  PageShell,
  PageShellHeader,
  PageShellTitle,
} from "@/components/layout/page-shell"
import { Badge } from "@/components/ui/badge"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { requireProjectSection } from "@/lib/require-project-section"
import { requireCharacter } from "@/lib/characters"
import { characterRoleLabel } from "@/lib/character-config"
import { listChaptersMentioning } from "@/lib/mentions"
import { AppearsIn } from "@/components/project/appears-in"
import { CharacterForm } from "./character-form"
import { DeleteCharacterButton } from "./delete-character-button"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; characterId: string }>
}): Promise<Metadata> {
  const { id, characterId } = await params
  const project = await requireProjectSection(id, "characters")
  const character = await requireCharacter(id, characterId)
  return { title: `${character.name} — ${project.title}` }
}

export default async function CharacterDetailPage({
  params,
}: {
  params: Promise<{ id: string; characterId: string }>
}) {
  const { id, characterId } = await params
  const project = await requireProjectSection(id, "characters")
  const character = await requireCharacter(id, characterId)
  const mentionedIn = await listChaptersMentioning(id, "character", characterId)

  return (
    <PageShell width="prose">
      <Link
        href={`/projects/${id}/characters`}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-3.5" />
        Characters
      </Link>

      <PageShellHeader className="flex-row items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{characterRoleLabel(character.role)}</Badge>
          </div>
          <PageShellTitle>{character.name}</PageShellTitle>
        </div>
        <DeleteCharacterButton projectId={id} characterId={characterId} name={character.name} />
      </PageShellHeader>

      <CharacterForm character={character} />

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Appears in</CardTitle>
          <CardDescription>Chapters that @mention this character.</CardDescription>
        </CardHeader>
        <CardContent>
          <AppearsIn projectId={id} projectType={project.type} chapters={mentionedIn} />
        </CardContent>
      </Card>
    </PageShell>
  )
}
