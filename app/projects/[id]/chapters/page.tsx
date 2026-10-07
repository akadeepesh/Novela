import type { Metadata } from "next"
import {
  PageShell,
  PageShellHeader,
  PageShellTitle,
  PageShellDescription,
} from "@/components/layout/page-shell"
import { EmptyState } from "@/components/ui/empty-state"
import { CreateButton } from "@/components/ui/create-button"
import { SECTION_DEFS, sectionLabel, sectionLabelSingular } from "@/lib/project-config"
import { requireProjectSection } from "@/lib/require-project-section"
import { listChaptersForProject } from "@/lib/chapters"
import { ChapterList } from "./chapter-list"
import { createChapterAction } from "./actions"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const project = await requireProjectSection(id, "chapters")
  return { title: `${sectionLabel("chapters", project.type)} — ${project.title}` }
}

export default async function ChaptersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const project = await requireProjectSection(id, "chapters")
  const chapters = await listChaptersForProject(id)
  const label = sectionLabel("chapters", project.type)
  const singular = sectionLabelSingular("chapters", project.type)

  return (
    <PageShell>
      <PageShellHeader>
        <PageShellTitle>{label}</PageShellTitle>
        <PageShellDescription>Where {project.title} actually gets written.</PageShellDescription>
      </PageShellHeader>

      {chapters.length === 0 ? (
        <EmptyState
          icon={SECTION_DEFS.chapters.icon}
          title={`No ${label.toLowerCase()} yet`}
          description={`Start your first ${singular.toLowerCase()} — you can always reorder or rename it later.`}
          action={
            <CreateButton action={createChapterAction.bind(null, id)}>New {singular.toLowerCase()}</CreateButton>
          }
        />
      ) : (
        <ChapterList
          projectId={id}
          chapters={chapters}
          label={label}
          singular={singular}
          projectType={project.type}
        />
      )}
    </PageShell>
  )
}
