"use client"

import { useParams, useSearchParams } from "next/navigation"
import { useProject, useSnapshot } from "@/lib/store/hooks"
import { buildExportDocument } from "@/lib/export/build-document"
import { LoadingView, NotFoundView } from "@/components/store/status-views"
import type { SerializedProject } from "@/lib/store/projects"
import { ReadView } from "./read-view"

export default function ReadBookPage() {
  const { id } = useParams<{ id: string }>()
  const chapter = useSearchParams().get("chapter") ?? undefined
  const project = useProject(id)
  if (project === undefined) return <LoadingView />
  if (project === null || !project.sections.includes("chapters")) return <NotFoundView />
  return <ReadBook project={project} chapter={chapter} />
}

function ReadBook({ project, chapter }: { project: SerializedProject; chapter?: string }) {
  // The exact document the exporter builds (same chapters, order, numbering,
  // header/footer, trim size and blurb), so what's read here is what gets
  // exported. Appendices aren't part of reading the book.
  const doc = useSnapshot(() =>
    buildExportDocument(project, { includeTitlePage: true, includeTOC: true, includeSections: [] })
  )
  if (doc === undefined) return <LoadingView />

  return (
    <>
      <title>{`Reading ${project.title}`}</title>
      <ReadView
        doc={doc}
        projectType={project.type}
        manuscriptSettings={project.manuscriptSettings}
        coverFrontUrl={project.coverFrontUrl}
        coverBackUrl={project.coverBackUrl}
        initialChapterId={chapter}
        backHref={chapter ? `/projects/${project.id}/chapters/${chapter}` : `/projects/${project.id}/chapters`}
      />
    </>
  )
}
