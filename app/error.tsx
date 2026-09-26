"use client"

import { useEffect } from "react"
import Link from "next/link"
import { ArrowClockwiseIcon, WarningIcon } from "@phosphor-icons/react/dist/ssr"
import { Button } from "@/components/ui/button"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Server-side logging hook — swap for a real error-tracking service
    // (Sentry, etc.) before launch. See README's "Production hardening"
    // section.
    console.error(error)
  }, [error])

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-background px-6">
      <div className="flex max-w-md flex-col items-center gap-5 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted text-destructive">
          <WarningIcon className="size-5" weight="duotone" />
        </div>

        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
          Something went wrong.
        </h1>

        <p className="font-serif text-base leading-relaxed text-muted-foreground">
          Nothing was lost — your work autosaves as you go. Try again, or head back
          and pick up where you left off.
        </p>

        <div className="flex items-center gap-3">
          <Button variant="outline" render={<Link href="/dashboard" />} nativeButton={false}>
            Back to dashboard
          </Button>
          <Button onClick={reset}>
            <ArrowClockwiseIcon />
            Try again
          </Button>
        </div>
      </div>
    </div>
  )
}
