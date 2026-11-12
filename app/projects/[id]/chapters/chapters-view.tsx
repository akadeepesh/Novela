"use client"

import {
  PageShell,
  PageShellHeader,
  PageShellTitle,
  PageShellDescription,
} from "@/components/layout/page-shell"
import { EmptyState } from "@/components/ui/empty-state"
import { NewLinkButton } from "@/components/ui/new-link-button"
import { SECTION_DEFS, sectionLabel, sectionLabelSingular } from "@/lib/project-config"
import { useProjectSection } from "@/components/project/project-context"
import { NotFoundView } from "@/components/store/status-views"
import { useChapters, useTrashedChapters } from "@/lib/store/hooks"
import { ChapterList } from "./chapter-list"

export function ChaptersView({ defaultView }: { defaultView: "list" | "board" }) {
  const project = useProjectSection("chapters")
  const projectId = project?.id ?? ""
  const chapters = useChapters(projectId)
  const trashed = useTrashedChapters(projectId)
  if (!project) return <NotFoundView />

  const id = project.id
  const label = sectionLabel("chapters", project.type)
  const singular = sectionLabelSingular("chapters", project.type)

  return (
    <PageShell>
      <title>{`${label} — ${project.title}`}</title>
      <PageShellHeader>
        <PageShellTitle>{label}</PageShellTitle>
        <PageShellDescription>Where {project.title} actually gets written.</PageShellDescription>
      </PageShellHeader>

      {chapters === undefined || trashed === undefined ? null : chapters.length === 0 && trashed.length === 0 ? (
        <EmptyState
          icon={SECTION_DEFS.chapters.icon}
          title={`No ${label.toLowerCase()} yet`}
          description={`Start your first ${singular.toLowerCase()} — you can always reorder or rename it later.`}
          action={
            <NewLinkButton href={`/projects/${id}/chapters/new`}>New {singular.toLowerCase()}</NewLinkButton>
          }
        />
      ) : (
        <ChapterList
          projectId={id}
          chapters={chapters}
          trashed={trashed}
          defaultView={defaultView}
          label={label}
          singular={singular}
          projectType={project.type}
        />
      )}
    </PageShell>
  )
}
