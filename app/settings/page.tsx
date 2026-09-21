import Link from "next/link"
import { ArrowLeftIcon, GearSixIcon } from "@phosphor-icons/react/dist/ssr"
import { PageShell, PageShellHeader, PageShellTitle, PageShellDescription } from "@/components/layout/page-shell"
import { EmptyState } from "@/components/ui/empty-state"

export default function SettingsPage() {
  return (
    <PageShell width="prose">
      <Link
        href="/dashboard"
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-3.5" />
        Dashboard
      </Link>
      <PageShellHeader>
        <PageShellTitle>Settings</PageShellTitle>
        <PageShellDescription>Account and preferences.</PageShellDescription>
      </PageShellHeader>
      <EmptyState
        icon={GearSixIcon}
        title="Coming soon"
        description="Display name, account details, and manuscript defaults will live here."
      />
    </PageShell>
  )
}
