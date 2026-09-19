import Link from "next/link"
import { ArrowLeftIcon } from "@phosphor-icons/react/dist/ssr"
import {
  PageShell,
  PageShellHeader,
  PageShellTitle,
} from "@/components/layout/page-shell"
import { Badge } from "@/components/ui/badge"
import { requireProjectSection } from "@/lib/require-project-section"
import { requireCharacter } from "@/lib/characters"
import { characterRoleLabel } from "@/lib/character-config"
import { CharacterForm } from "./character-form"
import { DeleteCharacterButton } from "./delete-character-button"

export default async function CharacterDetailPage({
  params,
}: {
  params: Promise<{ id: string; characterId: string }>
}) {
  const { id, characterId } = await params
  await requireProjectSection(id, "characters")
  const character = await requireCharacter(id, characterId)

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
    </PageShell>
  )
}
