import type { Metadata } from "next"
import {
  PageShell,
  PageShellHeader,
  PageShellTitle,
  PageShellDescription,
} from "@/components/layout/page-shell"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { SECTION_DEFS, projectTypeLabel, sectionLabel } from "@/lib/project-config"
import { requireProjectSection } from "@/lib/require-project-section"
import { OverviewForm } from "./overview-form"
import { DeleteProjectSection } from "./delete-project-section"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const project = await requireProjectSection(id, "overview")
  return { title: project.title }
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
        <div className="mb-1 flex items-center gap-2">
          <Badge>{projectTypeLabel(project.type)}</Badge>
          {project.genre ? <Badge variant="secondary">{project.genre}</Badge> : null}
        </div>
        <PageShellTitle>{project.title}</PageShellTitle>
        <PageShellDescription>
          Created {new Date(project.createdAt).toLocaleDateString(undefined, {
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </PageShellDescription>
      </PageShellHeader>

      <div className="flex flex-col gap-6">
        <OverviewForm key={project.updatedAt} project={project} />

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
