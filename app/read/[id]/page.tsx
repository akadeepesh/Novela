import type { Metadata } from "next"
import { requireProjectSection } from "@/lib/require-project-section"
import { requireUserId } from "@/lib/projects"
import { buildExportDocument } from "@/lib/export/build-document"
import { ReadView } from "./read-view"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const project = await requireProjectSection(id, "chapters")
  return { title: `Reading ${project.title}` }
}

export default async function ReadBookPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ chapter?: string }>
}) {
  const { id } = await params
  const { chapter } = await searchParams
  const project = await requireProjectSection(id, "chapters")
  const userId = await requireUserId()

  // The exact document the exporter builds — same chapters, order,
  // numbering, header/footer text, trim size and blurb — so what's read
  // here is what gets exported. Appendices aren't part of reading the book.
  const doc = await buildExportDocument(project, userId, {
    includeTitlePage: true,
    includeTOC: true,
    includeSections: [],
  })

  return (
    <ReadView
      doc={doc}
      projectId={id}
      projectType={project.type}
      manuscriptSettings={project.manuscriptSettings}
      coverFrontUrl={project.coverFrontUrl}
      coverBackUrl={project.coverBackUrl}
      initialChapterId={chapter}
      backHref={chapter ? `/projects/${id}/chapters/${chapter}` : `/projects/${id}/chapters`}
    />
  )
}
