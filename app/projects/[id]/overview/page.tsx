"use client"

import {
  PageShell,
  PageShellHeader,
  PageShellTitle,
  PageShellDescription,
} from "@/components/layout/page-shell"
import { Card, CardContent } from "@/components/ui/card"
import { SECTION_DEFS, sectionLabel } from "@/lib/project-config"
import { useProjectSection } from "@/components/project/project-context"
import { NotFoundView } from "@/components/store/status-views"
import { OverviewForm } from "./overview-form"
import { ManuscriptSettingsCard } from "./manuscript-settings-card"
import { CoverSettingsCard } from "./cover-settings-card"
import { StructureSettingsCard } from "./structure-settings-card"
import { DeleteProjectSection } from "./delete-project-section"

export default function OverviewPage() {
  const project = useProjectSection("overview")
  if (!project) return <NotFoundView />
  const id = project.id

  return (
    <PageShell width="prose">
      <title>{`${project.title} · Settings`}</title>
      <PageShellHeader>
        <PageShellTitle>Book Settings</PageShellTitle>
        <PageShellDescription>
          Shape what the book is and how it looks — cover, background, typography, and numbering.
        </PageShellDescription>
      </PageShellHeader>

      <div className="flex flex-col gap-6">
        {/* Keyed on the project, not updatedAt: any other setting saved on this
            page bumps updatedAt, and remounting would wipe unsaved typing. */}
        <OverviewForm key={project.id} project={project} />

        <CoverSettingsCard
          projectId={id}
          coverFrontUrl={project.coverFrontUrl}
          coverBackUrl={project.coverBackUrl}
          backCoverBlurb={project.blurb}
        />

        <ManuscriptSettingsCard projectId={id} settings={project.manuscriptSettings} />

        <StructureSettingsCard project={project} />

        <Card>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm font-medium text-foreground">Sections</p>
            <p className="text-sm text-muted-foreground">
              The sections in your sidebar. Need Characters, World, Plot, Notes or Research?
              Use “Add section” at the bottom of the sidebar.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {project.sections.map((sectionId) => {
                const { icon: IconComponent } = SECTION_DEFS[sectionId]
                return (
                  <span
                    key={sectionId}
                    className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground"
                  >
                    <IconComponent className="size-3.5" />
                    {sectionLabel(sectionId, project.type)}
                  </span>
                )
              })}
            </div>
          </CardContent>
        </Card>

        <DeleteProjectSection projectId={id} projectTitle={project.title} />
      </div>
    </PageShell>
  )
}
