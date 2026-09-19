import { requireProject } from "@/lib/projects"
import { ProjectSidebar } from "@/components/project/project-sidebar"

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const project = await requireProject(id)

  return (
    <div className="flex flex-1">
      <ProjectSidebar project={project} />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  )
}
