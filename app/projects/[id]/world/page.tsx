import { SECTION_DEFS } from "@/lib/project-config"
import { requireProjectSection } from "@/lib/require-project-section"
import { SectionComingSoon } from "@/components/project/section-coming-soon"

export default async function WorldPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await requireProjectSection(id, "world")

  return (
    <SectionComingSoon
      title="World"
      description="Places, factions, and everything else your story takes place in."
      icon={SECTION_DEFS.world.icon}
      note="World-building entries, linked to the chapters that mention them, land in Part 3."
    />
  )
}
