import type { Metadata } from "next"
import {
  PageShell,
  PageShellHeader,
  PageShellTitle,
  PageShellDescription,
} from "@/components/layout/page-shell"
import { Card, CardContent } from "@/components/ui/card"
import { SECTION_DEFS, sectionLabel } from "@/lib/project-config"
import { requireProjectSection } from "@/lib/require-project-section"
import { OverviewForm } from "./overview-form"
import { ManuscriptSettingsCard } from "./manuscript-settings-card"
import { CoverSettingsCard } from "./cover-settings-card"
import { DeleteProjectSection } from "./delete-project-section"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const project = await requireProjectSection(id, "overview")
  return { title: `${project.title} · Settings` }
}

export default async function OverviewPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const project = await requireProjectSection(id, "overview")

  return (
    <PageShell width="prose">
      <PageShellHeader>
        <PageShellTitle>Book Settings</PageShellTitle>
        <PageShellDescription>
          Shape what the book is and how it looks — header, footer, background, and typography.
        </PageShellDescription>
      </PageShellHeader>

      <div className="flex flex-col gap-6">
        <OverviewForm key={project.updatedAt} project={project} />

        <CoverSettingsCard
          projectId={id}
          coverFrontUrl={project.coverFrontUrl}
          coverBackUrl={project.coverBackUrl}
        />

        <ManuscriptSettingsCard projectId={id} settings={project.manuscriptSettings} />

        <Card>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm font-medium text-foreground">Structure</p>
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
