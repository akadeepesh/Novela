import Link from "next/link"
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { projectTypeLabel } from "@/lib/project-config"
import type { SerializedProject } from "@/lib/projects"

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.round(diffMs / 60000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.round(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.round(months / 12)}y ago`
}

export function ProjectCard({ project }: { project: SerializedProject }) {
  return (
    <Link href={`/projects/${project.id}`} className="block">
      <Card className="h-full transition-colors hover:border-primary/40 hover:bg-muted/30">
        <CardHeader>
          <CardTitle className="text-base">{project.title}</CardTitle>
          {project.blurb ? (
            <CardDescription className="line-clamp-2">{project.blurb}</CardDescription>
          ) : (
            <CardDescription className="italic">No description yet</CardDescription>
          )}
        </CardHeader>
        <CardFooter className="items-center justify-between border-t pt-4">
          <div className="flex items-center gap-1.5">
            <Badge>{projectTypeLabel(project.type)}</Badge>
            {project.genre ? <Badge variant="secondary">{project.genre}</Badge> : null}
          </div>
          <span className="text-xs text-muted-foreground">
            Updated {relativeTime(project.updatedAt)}
          </span>
        </CardFooter>
      </Card>
    </Link>
  )
}
