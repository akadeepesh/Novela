import Link from "next/link"
import { ArrowRightIcon, FilePdfIcon } from "@phosphor-icons/react/dist/ssr"
import { cn } from "cn"

/**
 * The quiet second door into the app: for a book that already exists as a
 * PDF. Deliberately low-key — "Start writing" stays the primary path.
 */
export function ImportLink({ className }: { className?: string }) {
  return (
    <Link
      href="/projects/import"
      className={cn(
        "group inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
        className
      )}
    >
      <FilePdfIcon className="size-3.5" weight="duotone" />
      Continue a book you’ve already written
      <ArrowRightIcon className="size-3 -translate-x-0.5 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100" />
    </Link>
  )
}
