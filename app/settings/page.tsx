import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeftIcon } from "@phosphor-icons/react/dist/ssr"
import { PageShell, PageShellHeader, PageShellTitle, PageShellDescription } from "@/components/layout/page-shell"
import { StoragePanel } from "./storage-panel"

export const metadata: Metadata = { title: "Settings and backup" }

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
        <PageShellTitle>Settings and backup</PageShellTitle>
        <PageShellDescription>
          Everything you write is stored in this browser, on this device. Nothing is uploaded.
        </PageShellDescription>
      </PageShellHeader>
      <StoragePanel />
    </PageShell>
  )
}
