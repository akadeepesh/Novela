import type { Metadata } from "next"
import Link from "next/link"
import { PlusIcon, FolderOpenIcon } from "@phosphor-icons/react/dist/ssr"
import {
  PageShell,
  PageShellHeader,
  PageShellTitle,
  PageShellDescription,
} from "@/components/layout/page-shell"
import { EmptyState } from "@/components/ui/empty-state"
import { Button } from "@/components/ui/button"
import { ProjectCard } from "@/components/project/project-card"
import { listProjectsForCurrentUser } from "@/lib/projects"
import { auth } from "@/auth"
import { signOutAction } from "./actions"

export const metadata: Metadata = { title: "Dashboard" }

export default async function DashboardPage() {
  const [session, projects] = await Promise.all([auth(), listProjectsForCurrentUser()])

  return (
    <PageShell>
      <PageShellHeader className="flex-row items-center justify-between">
        <div>
          <PageShellTitle>Your projects</PageShellTitle>
          <PageShellDescription>Signed in as {session?.user?.email}</PageShellDescription>
        </div>
        <div className="flex items-center gap-2">
          <form action={signOutAction}>
            <Button type="submit" variant="outline" size="sm">
              Sign out
            </Button>
          </form>
          <Button size="sm" render={<Link href="/projects/new" />} nativeButton={false}>
            <PlusIcon />
            New project
          </Button>
        </div>
      </PageShellHeader>

      {projects.length === 0 ? (
        <EmptyState
          icon={FolderOpenIcon}
          title="No projects yet"
          description="Start your first novel, poetry collection, or story bible — it takes less than a minute to set up."
          action={
            <Button size="sm" render={<Link href="/projects/new" />} nativeButton={false}>
              <PlusIcon />
              New project
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </PageShell>
  )
}
