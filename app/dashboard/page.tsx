import { FolderOpenIcon } from "@phosphor-icons/react/dist/ssr"
import { auth } from "@/auth"
import { PageShell, PageShellHeader, PageShellTitle, PageShellDescription } from "@/components/layout/page-shell"
import { EmptyState } from "@/components/ui/empty-state"
import { Button } from "@/components/ui/button"
import { signOutAction } from "./actions"

export default async function DashboardPage() {
  const session = await auth()

  return (
    <PageShell>
      <PageShellHeader className="flex-row items-center justify-between">
        <div>
          <PageShellTitle>Your projects</PageShellTitle>
          <PageShellDescription>
            Signed in as {session?.user?.email}
          </PageShellDescription>
        </div>
        <form action={signOutAction}>
          <Button type="submit" variant="outline" size="sm">
            Sign out
          </Button>
        </form>
      </PageShellHeader>

      <EmptyState
        icon={FolderOpenIcon}
        title="No projects yet"
        description="Once project creation lands (Part 1), your novels, poetry collections, and story bibles will live here."
      />
    </PageShell>
  )
}
