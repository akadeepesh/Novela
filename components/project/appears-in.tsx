import Link from "next/link"
import { sectionLabel, type ProjectType } from "@/lib/project-config"
import type { ChapterMentionRef } from "@/lib/mentions"

export function AppearsIn({
  projectId,
  projectType,
  chapters,
}: {
  projectId: string
  projectType: ProjectType
  chapters: ChapterMentionRef[]
}) {
  const label = sectionLabel("chapters", projectType).toLowerCase()

  if (chapters.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Not mentioned in any {label} yet — @mention it from the editor and it&apos;ll show up here.
      </p>
    )
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {chapters.map((chapter) => (
        <Link
          key={chapter.id}
          href={`/projects/${projectId}/chapters/${chapter.id}`}
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs text-foreground transition-colors hover:border-primary/40 hover:bg-muted/40"
        >
          {chapter.title}
        </Link>
      ))}
    </div>
  )
}
