import { SECTION_DEFS } from "@/lib/project-config"
import { requireProjectSection } from "@/lib/require-project-section"
import { SectionComingSoon } from "@/components/project/section-coming-soon"

export default async function ExportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await requireProjectSection(id, "export")

  return (
    <SectionComingSoon
      title="Export"
      description="Turn this project into a real manuscript file."
      icon={SECTION_DEFS.export.icon}
      note="PDF, EPUB, and DOCX export, with proper typeset styling, lands in Part 5."
    />
  )
}
