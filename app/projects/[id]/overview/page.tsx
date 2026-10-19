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
import { requireUserId } from "@/lib/projects"
import { getEntitlements } from "@/lib/entitlements"
import { OverviewForm } from "./overview-form"
import { ManuscriptSettingsCard } from "./manuscript-settings-card"
import { CoverSettingsCard } from "./cover-settings-card"
import { StructureSettingsCard } from "./structure-settings-card"
import { ShareCard } from "./share-card"
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
  const { features } = await getEntitlements(await requireUserId())

  return (
    <PageShell width="prose">
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

        <StructureSettingsCard project={project} allTrimSizes={features.allTrimSizes} />

        <ShareCard projectId={id} proFeatures={features.readerComments} />

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
