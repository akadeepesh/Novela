import Link from "next/link"
import { ArrowLeftIcon } from "@phosphor-icons/react/dist/ssr"
import { Button } from "@/components/ui/button"
import {
  PageShell,
  PageShellHeader,
  PageShellTitle,
  PageShellDescription,
} from "@/components/layout/page-shell"

/** Shown instead of a "new …" screen when the account is at its plan limit. */
export function LimitReached({
  message,
  backHref,
  backLabel,
  showUpgrade = false,
}: {
  message: string
  backHref: string
  backLabel: string
  showUpgrade?: boolean
}) {
  return (
    <PageShell width="prose">
      <Link
        href={backHref}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-3.5" />
        {backLabel}
      </Link>
      <PageShellHeader>
        <PageShellTitle>Limit reached</PageShellTitle>
        <PageShellDescription>{message}</PageShellDescription>
      </PageShellHeader>
      {showUpgrade ? (
        <Button className="mt-6 w-fit" render={<Link href="/pricing" />} nativeButton={false}>
          See Pro plans
        </Button>
      ) : null}
    </PageShell>
  )
}
