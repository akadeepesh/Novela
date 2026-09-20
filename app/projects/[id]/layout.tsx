import { cookies } from "next/headers"
import { requireProject } from "@/lib/projects"
import { listSearchIndexForProject } from "@/lib/search"
import { ProjectShell } from "@/components/project/project-shell"

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const project = await requireProject(id)
  const searchItems = await listSearchIndexForProject(id)
  const cookieStore = await cookies()
  const defaultCollapsed = cookieStore.get("sidebar-collapsed")?.value === "1"

  return (
    <ProjectShell project={project} searchItems={searchItems} defaultCollapsed={defaultCollapsed}>
      {children}
    </ProjectShell>
  )
}
