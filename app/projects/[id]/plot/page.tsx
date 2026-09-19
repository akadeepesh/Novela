import { SECTION_DEFS } from "@/lib/project-config"
import { requireProjectSection } from "@/lib/require-project-section"
import { SectionComingSoon } from "@/components/project/section-coming-soon"

export default async function PlotPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await requireProjectSection(id, "plot")

  return (
    <SectionComingSoon
      title="Plot"
      description="Threads and arcs running through your story."
      icon={SECTION_DEFS.plot.icon}
      note="Plot threads, tracked by status and linked to chapters, land in Part 3."
    />
  )
}
