import type { Metadata } from "next"
import Link from "next/link"
import { CompassIcon } from "@phosphor-icons/react/dist/ssr"
import { Button } from "@/components/ui/button"
import { APP_NAME } from "@/lib/brand"

export const metadata: Metadata = { title: "Page not found" }

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-background px-6">
      <div className="flex max-w-md flex-col items-center gap-5 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted text-primary">
          <CompassIcon className="size-5" weight="duotone" />
        </div>

        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
          This page wandered off.
        </h1>

        <p className="font-serif text-base leading-relaxed text-muted-foreground">
          There&apos;s nothing here — the page may have been moved, renamed, or never
          existed in the first place.
        </p>

        <Button render={<Link href="/" />} nativeButton={false}>
          Back to {APP_NAME}
        </Button>
      </div>
    </div>
  )
}
