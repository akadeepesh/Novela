import { cookies } from "next/headers"
import { ProjectLoader } from "@/components/project/project-loader"

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const cookieStore = await cookies()
  const defaultCollapsed = cookieStore.get("sidebar-collapsed")?.value === "1"

  return (
    <ProjectLoader projectId={id} defaultCollapsed={defaultCollapsed}>
      {children}
    </ProjectLoader>
  )
}
