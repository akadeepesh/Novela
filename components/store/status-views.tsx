"use client"

import Link from "next/link"
import { CompassIcon } from "@phosphor-icons/react/dist/ssr"
import { Button } from "@/components/ui/button"

/** Shown for the moment it takes to read from the local database. Kept quiet on purpose. */
export function LoadingView() {
  return <div className="flex flex-1 items-center justify-center p-10" aria-busy="true" />
}

/** The "not found" screen, for records that don't exist in this browser. */
export function NotFoundView({
  backHref = "/dashboard",
  backLabel = "Back to your writings",
}: {
  backHref?: string
  backLabel?: string
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-background px-6 py-16">
      <title>Not found</title>
      <div className="flex max-w-md flex-col items-center gap-5 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted text-primary">
          <CompassIcon className="size-5" weight="duotone" />
        </div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
          This page wandered off.
        </h1>
        <p className="font-serif text-base leading-relaxed text-muted-foreground">
          There&apos;s nothing here. It may have been deleted, or it was created in another
          browser. Your writing is stored in the browser you wrote it in.
        </p>
        <Button render={<Link href={backHref} />} nativeButton={false}>
          {backLabel}
        </Button>
      </div>
    </div>
  )
}
