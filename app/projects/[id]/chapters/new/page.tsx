import type { Metadata } from "next"
import { connectDB } from "@/lib/db"
import { Chapter } from "@/lib/models/chapter"
import { requireUserId } from "@/lib/projects"
import { sectionLabelSingular } from "@/lib/project-config"
import { requireProjectSection } from "@/lib/require-project-section"
import { listMentionablesForProject } from "@/lib/mentions"
import { initialChapterContent } from "@/lib/script-scaffold"
import { nextDefaultName } from "@/lib/default-name"
import type { SerializedChapter } from "@/lib/chapters"
import { ManuscriptEditor } from "../[chapterId]/manuscript-editor"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const project = await requireProjectSection(id, "chapters")
  return { title: `New ${sectionLabelSingular("chapters", project.type).toLowerCase()} — ${project.title}` }
}

// The editor in "draft" mode (empty id): nothing is saved until the first
// change, so opening this page and leaving creates no chapter.
export default async function NewChapterPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const project = await requireProjectSection(id, "chapters")
  const userId = await requireUserId()
  const mentionables = await listMentionablesForProject(id)

  await connectDB()
  const existing = await Chapter.find({ projectId: id, ownerId: userId })
    .select("title")
    .lean<{ title: string }[]>()
  const singular = sectionLabelSingular("chapters", project.type)

  const draft: SerializedChapter = {
    id: "",
    projectId: id,
    title: nextDefaultName(
      existing.map((c) => c.title),
      singular
    ),
    order: existing.length,
    wordCount: 0,
    status: "draft",
    updatedAt: "",
    content: initialChapterContent(project.type),
    version: 0,
  }

  return (
    <ManuscriptEditor
      projectId={id}
      projectType={project.type}
      chapter={draft}
      chapterLabelSingular={singular}
      manuscriptSettings={project.manuscriptSettings}
      mentionables={mentionables}
    />
  )
}
