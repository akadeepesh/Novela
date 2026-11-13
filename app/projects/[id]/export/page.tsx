"use client"

import {
  PageShell,
  PageShellHeader,
  PageShellTitle,
  PageShellDescription,
} from "@/components/layout/page-shell"
import { sectionLabel, type SectionId } from "@/lib/project-config"
import { useProjectSection } from "@/components/project/project-context"
import { NotFoundView } from "@/components/store/status-views"
import { ExportForm } from "./export-form"
import { ProjectFileCard } from "./project-file-card"

const OPTIONAL_SECTIONS: SectionId[] = ["characters", "world", "plot", "notes", "research"]

export default function ExportPage() {
  const project = useProjectSection("export")
  if (!project) return <NotFoundView />

  const availableSections = OPTIONAL_SECTIONS.filter((s) => project.sections.includes(s)).map((id) => ({
    id,
    label: sectionLabel(id, project.type),
  }))

  return (
    <PageShell width="prose">
      <title>{`Export — ${project.title}`}</title>
      <PageShellHeader>
        <PageShellTitle>Export</PageShellTitle>
        <PageShellDescription>Turn {project.title} into a real file.</PageShellDescription>
      </PageShellHeader>

      <ExportForm
        projectId={project.id}
        projectTitle={project.title}
        defaultAuthorName={project.authorName}
        availableSections={availableSections}
        project={project}
      />
      <ProjectFileCard projectId={project.id} />
    </PageShell>
  )
}
