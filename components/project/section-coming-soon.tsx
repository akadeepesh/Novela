import type { Icon } from "@phosphor-icons/react"
import {
  PageShell,
  PageShellHeader,
  PageShellTitle,
  PageShellDescription,
} from "@/components/layout/page-shell"
import { EmptyState } from "@/components/ui/empty-state"

export function SectionComingSoon({
  title,
  description,
  icon,
  note,
}: {
  title: string
  description?: string
  icon: Icon
  note: string
}) {
  return (
    <PageShell>
      <PageShellHeader>
        <PageShellTitle>{title}</PageShellTitle>
        {description ? <PageShellDescription>{description}</PageShellDescription> : null}
      </PageShellHeader>
      <EmptyState icon={icon} title="Coming soon" description={note} />
    </PageShell>
  )
}
