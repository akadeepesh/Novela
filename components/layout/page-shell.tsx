import { cn } from "cn"

type PageShellProps = React.ComponentProps<"div"> & {
  /** Constrain content width. "wide" for dashboards/grids, "prose" for long text. */
  width?: "wide" | "prose" | "full"
}

const widthClass: Record<NonNullable<PageShellProps["width"]>, string> = {
  wide: "max-w-6xl",
  prose: "max-w-3xl",
  full: "max-w-none",
}

/**
 * Consistent outer padding + max-width wrapper for app chrome pages
 * (dashboard, project settings, story bible screens, etc).
 * NOT used inside the manuscript editor — that has its own page-surface
 * component (Part 2) so writers can customize background/header/footer
 * independently of the app shell.
 */
function PageShell({ className, width = "wide", ...props }: PageShellProps) {
  return (
    <div
      data-slot="page-shell"
      className={cn("mx-auto w-full px-6 py-10 sm:px-10", widthClass[width], className)}
      {...props}
    />
  )
}

function PageShellHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="page-shell-header"
      className={cn("mb-8 flex flex-col gap-1.5", className)}
      {...props}
    />
  )
}

function PageShellTitle({ className, ...props }: React.ComponentProps<"h1">) {
  return (
    <h1
      data-slot="page-shell-title"
      className={cn("font-heading text-2xl font-semibold tracking-tight text-foreground", className)}
      {...props}
    />
  )
}

function PageShellDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="page-shell-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export { PageShell, PageShellHeader, PageShellTitle, PageShellDescription }
