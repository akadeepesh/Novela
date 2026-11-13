"use client"

import { sectionLabelSingular } from "@/lib/project-config"
import { initialChapterContent } from "@/lib/script-scaffold"
import { nextDefaultName } from "@/lib/default-name"
import { useProjectSection } from "@/components/project/project-context"
import { LoadingView, NotFoundView } from "@/components/store/status-views"
import { useSnapshot } from "@/lib/store/hooks"
import { listChaptersForProject, type SerializedChapter } from "@/lib/store/chapters"
import { listMentionablesForProject } from "@/lib/store/mentions"
import type { SerializedProject } from "@/lib/store/projects"
import { ManuscriptEditor } from "../[chapterId]/manuscript-editor"

// The editor in "draft" mode (empty id): nothing is saved until the first
// change, so opening this page and leaving creates no chapter.
export default function NewChapterPage() {
  const project = useProjectSection("chapters")
  if (!project) return <NotFoundView />
  return <DraftEditor project={project} />
}

function DraftEditor({ project }: { project: SerializedProject }) {
  const singular = sectionLabelSingular("chapters", project.type)
  const data = useSnapshot(async () => ({
    existing: await listChaptersForProject(project.id),
    mentionables: await listMentionablesForProject(project.id),
  }))
  if (data === undefined) return <LoadingView />

  const draft: SerializedChapter = {
    id: "",
    projectId: project.id,
    title: nextDefaultName(
      data.existing.map((c) => c.title),
      singular
    ),
    order: data.existing.length,
    wordCount: 0,
    status: "draft",
    synopsis: "",
    label: "",
    flashback: false,
    storyDate: "",
    updatedAt: "",
    content: initialChapterContent(project.type),
    version: 0,
  }

  return (
    <>
      <title>{`New ${singular.toLowerCase()} — ${project.title}`}</title>
      <ManuscriptEditor
        projectId={project.id}
        projectType={project.type}
        chapter={draft}
        chapterLabelSingular={singular}
        manuscriptSettings={project.manuscriptSettings}
        mentionables={data.mentionables}
      />
    </>
  )
}
