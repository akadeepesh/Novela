import type { Metadata } from "next"
import {
  PageShell,
  PageShellHeader,
  PageShellTitle,
  PageShellDescription,
} from "@/components/layout/page-shell"
import { sectionLabel, type SectionId } from "@/lib/project-config"
import { requireProjectSection } from "@/lib/require-project-section"
import { requireUserId } from "@/lib/projects"
import { getEntitlements } from "@/lib/entitlements"
import { effectiveTrimSize } from "@/lib/export-config"
import { ExportForm } from "./export-form"

const OPTIONAL_SECTIONS: SectionId[] = ["characters", "world", "plot", "notes", "research"]

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const project = await requireProjectSection(id, "export")
  return { title: `Export — ${project.title}` }
}

export default async function ExportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const project = await requireProjectSection(id, "export")
  const { features } = await getEntitlements(await requireUserId())

  const availableSections = OPTIONAL_SECTIONS.filter((s) => project.sections.includes(s)).map(
    (id) => ({ id, label: sectionLabel(id, project.type) })
  )

  return (
    <PageShell width="prose">
      <PageShellHeader>
        <PageShellTitle>Export</PageShellTitle>
        <PageShellDescription>Turn {project.title} into a real file.</PageShellDescription>
      </PageShellHeader>

      <ExportForm
        projectId={id}
        projectTitle={project.title}
        defaultAuthorName={project.authorName}
        availableSections={availableSections}
        trimSize={effectiveTrimSize(project.exportTrimSize, features.allTrimSizes)}
      />
    </PageShell>
  )
}
