import { SECTION_DEFS, sectionLabel } from "@/lib/project-config"
import { requireProjectSection } from "@/lib/require-project-section"
import { SectionComingSoon } from "@/components/project/section-coming-soon"

export default async function ChaptersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const project = await requireProjectSection(id, "chapters")
  const label = sectionLabel("chapters", project.type)

  return (
    <SectionComingSoon
      title={label}
      description={`Where you'll actually write.`}
      icon={SECTION_DEFS.chapters.icon}
      note={`The full writing editor — rich text, autosave, focus mode, and a customizable page background/header/footer — lands in Part 2.`}
    />
  )
}
