import type { Icon } from "@phosphor-icons/react"
import { cn } from "cn"

type EmptyStateProps = React.ComponentProps<"div"> & {
  icon?: Icon
  title: string
  description?: string
  action?: React.ReactNode
}

function EmptyState({ icon: IconComponent, title, description, action, className, ...props }: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border px-6 py-16 text-center",
        className
      )}
      {...props}
    >
      {IconComponent ? (
        <div className="mb-1 flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <IconComponent className="size-5" weight="duotone" />
        </div>
      ) : null}
      <p className="font-heading text-base font-medium text-foreground">{title}</p>
      {description ? (
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
}

export { EmptyState }
