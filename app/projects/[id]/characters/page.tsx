import { SECTION_DEFS } from "@/lib/project-config"
import { requireProjectSection } from "@/lib/require-project-section"
import { SectionComingSoon } from "@/components/project/section-coming-soon"

export default async function CharactersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await requireProjectSection(id, "characters")

  return (
    <SectionComingSoon
      title="Characters"
      description="Everyone who appears in your story."
      icon={SECTION_DEFS.characters.icon}
      note="Character profiles, plus automatic backlinks showing which chapters they appear in, land in Part 3."
    />
  )
}
