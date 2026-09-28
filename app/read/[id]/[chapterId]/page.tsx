import type { Metadata } from "next"
import { requireProjectSection } from "@/lib/require-project-section"
import { listChaptersForProject, requireChapter } from "@/lib/chapters"
import { sectionLabelSingular, CHAPTER_LABEL_SINGULAR } from "@/lib/project-config"
import { chapterNumberLabel } from "@/lib/chapter-numbering"
import { tiptapToBlocks } from "@/lib/export/document-model"
import { ReadView } from "./read-view"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; chapterId: string }>
}): Promise<Metadata> {
  const { id, chapterId } = await params
  const project = await requireProjectSection(id, "chapters")
  const chapter = await requireChapter(id, chapterId)
  return { title: `Reading ${chapter.title} — ${project.title}` }
}

export default async function ReadPage({
  params,
}: {
  params: Promise<{ id: string; chapterId: string }>
}) {
  const { id, chapterId } = await params
  const project = await requireProjectSection(id, "chapters")
  const chapter = await requireChapter(id, chapterId)
  const chapters = await listChaptersForProject(id)

  const index = Math.max(
    0,
    chapters.findIndex((c) => c.id === chapterId)
  )

  const numberLabel = chapterNumberLabel({
    style: project.chapterNumberingStyle,
    prefix: project.chapterNumberingPrefix,
    index,
    singular: CHAPTER_LABEL_SINGULAR[project.type],
  })

  return (
    <ReadView
      projectId={id}
      chapterId={chapterId}
      title={chapter.title}
      numberLabel={numberLabel}
      chapterLabelSingular={sectionLabelSingular("chapters", project.type)}
      blocks={tiptapToBlocks(chapter.content)}
      manuscriptSettings={project.manuscriptSettings}
      projectType={project.type}
    />
  )
}
