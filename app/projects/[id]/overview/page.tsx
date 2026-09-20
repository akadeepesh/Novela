import type { Metadata } from "next"
import {
  PageShell,
  PageShellHeader,
  PageShellTitle,
  PageShellDescription,
} from "@/components/layout/page-shell"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { ProgressCard } from "@/components/project/progress-card"
import { SECTION_DEFS, projectTypeLabel, sectionLabel } from "@/lib/project-config"
import { requireProjectSection } from "@/lib/require-project-section"
import { getProjectProgress } from "@/lib/analytics"
import { OverviewForm } from "./overview-form"

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
  const progress = await getProjectProgress(id, project.targetWordCount, project.dailyWordGoal)

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
        <ProgressCard progress={progress} />

        <OverviewForm project={project} />

        <Card>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm font-medium text-foreground">Structure</p>
            <p className="text-sm text-muted-foreground">
              These sections were set up when you created this project — you can revisit that
              choice any time by asking us to add or remove sections.
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
      </div>
    </PageShell>
  )
}
