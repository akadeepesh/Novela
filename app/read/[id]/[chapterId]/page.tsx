"use client"

import { useParams } from "next/navigation"
import { useChapter, useChapters, useProject } from "@/lib/store/hooks"
import { sectionLabelSingular, CHAPTER_LABEL_SINGULAR } from "@/lib/project-config"
import { chapterNumberLabel } from "@/lib/chapter-numbering"
import { tiptapToBlocks } from "@/lib/export/document-model"
import { LoadingView, NotFoundView } from "@/components/store/status-views"
import { ReadView } from "./read-view"

export default function ReadPage() {
  const { id, chapterId } = useParams<{ id: string; chapterId: string }>()
  const project = useProject(id)
  const chapter = useChapter(id, chapterId)
  const chapters = useChapters(id)

  if (project === undefined || chapter === undefined || chapters === undefined) return <LoadingView />
  if (!project || !project.sections.includes("chapters") || !chapter) return <NotFoundView />

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
    <>
      <title>{`Reading ${chapter.title} — ${project.title}`}</title>
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
    </>
  )
}
