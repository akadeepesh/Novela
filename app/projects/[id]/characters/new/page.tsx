import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeftIcon } from "@phosphor-icons/react/dist/ssr"
import { PageShell, PageShellHeader, PageShellTitle } from "@/components/layout/page-shell"
import { requireProjectSection } from "@/lib/require-project-section"
import { connectDB } from "@/lib/db"
import { Character } from "@/lib/models/character"
import { requireUserId } from "@/lib/projects"
import { LIMITS, limitMessage } from "@/lib/limits"
import { LimitReached } from "@/components/project/limit-reached"
import type { SerializedCharacter } from "@/lib/characters"
import { CharacterForm } from "./[characterId]/character-form"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const project = await requireProjectSection(id, "characters")
  return { title: `New character — ${project.title}` }
}

// A blank form. Nothing is saved until the person presses "Create character".
export default async function NewCharacterPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  await requireProjectSection(id, "characters")
  const userId = await requireUserId()
  await connectDB()
  if ((await Character.countDocuments({ projectId: id, ownerId: userId })) >= LIMITS.characters) {
    return (
      <LimitReached
        message={limitMessage("characters")}
        backHref={`/projects/${id}/characters`}
        backLabel="Characters"
      />
    )
  }
  const draft: SerializedCharacter = { id: "", projectId: id, name: "", role: "supporting", aliases: [], createdAt: "", updatedAt: "" }

  return (
    <PageShell width="prose">
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
