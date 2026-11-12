"use client"

import { useParams, useSearchParams } from "next/navigation"
import { sectionLabelSingular } from "@/lib/project-config"
import { useProjectSection } from "@/components/project/project-context"
import { LoadingView, NotFoundView } from "@/components/store/status-views"
import { useSnapshot } from "@/lib/store/hooks"
import { getChapter } from "@/lib/store/chapters"
import { listMentionablesForProject } from "@/lib/store/mentions"
import type { SerializedProject } from "@/lib/store/projects"
import { ManuscriptEditor } from "./manuscript-editor"

export default function ChapterEditorPage() {
  const project = useProjectSection("chapters")
  const { chapterId } = useParams<{ id: string; chapterId: string }>()
  const openComments = useSearchParams().get("comments") === "1"
  if (!project) return <NotFoundView />
  // Keyed so moving to another chapter loads it fresh.
  return <ChapterEditorLoader key={chapterId} project={project} chapterId={chapterId} openComments={openComments} />
}

function ChapterEditorLoader({
  project,
  chapterId,
  openComments,
}: {
  project: SerializedProject
  chapterId: string
  openComments: boolean
}) {
  // Read once: the editor owns the text from here on, and saves it itself.
  const data = useSnapshot(async () => ({
    chapter: await getChapter(project.id, chapterId),
    mentionables: await listMentionablesForProject(project.id),
  }))

  if (data === undefined) return <LoadingView />
  if (!data.chapter) return <NotFoundView backHref={`/projects/${project.id}/chapters`} backLabel="Back to the book" />

  return (
    <>
      <title>{`${data.chapter.title} — ${project.title}`}</title>
      <ManuscriptEditor
        projectId={project.id}
        projectType={project.type}
        chapter={data.chapter}
        chapterLabelSingular={sectionLabelSingular("chapters", project.type)}
        manuscriptSettings={project.manuscriptSettings}
        mentionables={data.mentionables}
        openComments={openComments}
      />
    </>
  )
}
