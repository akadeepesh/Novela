import { SECTION_DEFS } from "@/lib/project-config"
import { requireProjectSection } from "@/lib/require-project-section"
import { SectionComingSoon } from "@/components/project/section-coming-soon"

export default async function ResearchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await requireProjectSection(id, "research")

  return (
    <SectionComingSoon
      title="Research"
      description="Reference material, links, and source notes."
      icon={SECTION_DEFS.research.icon}
      note="Research notes, saved links, and attachments land in Part 4."
    />
  )
}
