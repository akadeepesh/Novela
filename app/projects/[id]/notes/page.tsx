import { SECTION_DEFS } from "@/lib/project-config"
import { requireProjectSection } from "@/lib/require-project-section"
import { SectionComingSoon } from "@/components/project/section-coming-soon"

export default async function NotesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await requireProjectSection(id, "notes")

  return (
    <SectionComingSoon
      title="Notes"
      description="A scratchpad for anything that doesn't belong anywhere else yet."
      icon={SECTION_DEFS.notes.icon}
      note="Freeform, taggable notes land in Part 4."
    />
  )
}
