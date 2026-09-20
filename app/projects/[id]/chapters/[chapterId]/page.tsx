import { sectionLabel } from "@/lib/project-config"
import { requireProjectSection } from "@/lib/require-project-section"
import { requireChapter } from "@/lib/chapters"
import { listMentionablesForProject } from "@/lib/mentions"
import { ManuscriptEditor } from "./manuscript-editor"

export default async function ChapterEditorPage({
  params,
}: {
  params: Promise<{ id: string; chapterId: string }>
}) {
  const { id, chapterId } = await params
  const project = await requireProjectSection(id, "chapters")
  const chapter = await requireChapter(id, chapterId)
  const mentionables = await listMentionablesForProject(id)

  const label = sectionLabel("chapters", project.type)
  const singular = label.endsWith("s") ? label.slice(0, -1) : label

  return (
    <ManuscriptEditor
      projectId={id}
      projectType={project.type}
      chapter={chapter}
      chapterLabelSingular={singular}
      manuscriptSettings={project.manuscriptSettings}
      mentionables={mentionables}
    />
  )
}
