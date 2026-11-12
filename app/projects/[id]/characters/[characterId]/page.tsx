"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeftIcon } from "@phosphor-icons/react/dist/ssr"
import {
  PageShell,
  PageShellHeader,
  PageShellTitle,
} from "@/components/layout/page-shell"
import { Badge } from "@/components/ui/badge"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { characterRoleLabel } from "@/lib/character-config"
import { AppearsIn } from "@/components/project/appears-in"
import { CharacterForm } from "./character-form"
import { DeleteCharacterButton } from "./delete-character-button"
import { useProjectSection } from "@/components/project/project-context"
import { LoadingView, NotFoundView } from "@/components/store/status-views"
import { useCharacter, useChaptersMentioning } from "@/lib/store/hooks"

export default function Page() {
  const project = useProjectSection("characters")
  const { characterId } = useParams<{ id: string; characterId: string }>()
  const projectId = project?.id ?? ""
  const character = useCharacter(projectId, characterId)
  const mentionedIn = useChaptersMentioning(projectId, "character", characterId)
  if (!project) return <NotFoundView />
  const id = project.id
  if (character === undefined) return <LoadingView />
  if (character === null) return <NotFoundView backHref={`/projects/${id}/characters`} backLabel="Back to Characters" />

  return (
    <PageShell width="prose">
      <title>{`${character.name} — ${project.title}`}</title>
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

      <CharacterForm key={character.id} character={character} />

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Appears in</CardTitle>
          <CardDescription>Chapters that @mention this character.</CardDescription>
        </CardHeader>
        <CardContent>
          <AppearsIn projectId={id} projectType={project.type} chapters={mentionedIn ?? []} />
        </CardContent>
      </Card>
    </PageShell>
  )
}
