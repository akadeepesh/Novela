import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeftIcon } from "@phosphor-icons/react/dist/ssr"
import {
  PageShell,
  PageShellHeader,
  PageShellTitle,
  PageShellDescription,
} from "@/components/layout/page-shell"
import { requireUserId } from "@/lib/projects"
import { getTrashedProjects, purgeExpiredTrash } from "@/lib/trash"
import { TRASH_DAYS } from "@/lib/trash-config"
import { TrashList } from "./trash-list"

export const metadata: Metadata = { title: "Trash" }

export default async function TrashPage() {
  const userId = await requireUserId()
  await purgeExpiredTrash(userId)
  const items = await getTrashedProjects(userId)

  return (
    <PageShell width="prose">
      <Link
        href="/dashboard"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-3.5" />
        Your writings
      </Link>
      <PageShellHeader>
        <PageShellTitle>Trash</PageShellTitle>
        <PageShellDescription>
          Projects stay here for {TRASH_DAYS} days, then they are deleted for good. Restore one to
          bring everything back.
        </PageShellDescription>
      </PageShellHeader>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">The Trash is empty.</p>
      ) : (
        <TrashList items={items} />
      )}
    </PageShell>
  )
}
