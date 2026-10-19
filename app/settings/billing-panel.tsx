"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog"
import type { BillingProviderId } from "@/lib/billing/types"
import { cancelSubscriptionAction, openBillingPortalAction, resumeSubscriptionAction } from "@/app/actions/billing"

export function BillingPanel({
  plan,
  provider,
  status,
  renewsOn,
  cancelAtPeriodEnd,
}: {
  plan: "free" | "pro"
  provider: BillingProviderId | null
  status: string | null
  renewsOn: string | null
  cancelAtPeriodEnd: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [confirmCancel, setConfirmCancel] = useState(false)

  function run(action: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setError(null)
    startTransition(async () => {
      const result = await action().catch(() => ({ ok: false as const, error: "Something went wrong. Please try again." }))
      if (!result.ok) setError(result.error)
      router.refresh()
    })
  }

  function openPortal() {
    setError(null)
    startTransition(async () => {
      const result = await openBillingPortalAction().catch(() => null)
      if (result?.ok) window.location.assign(result.url)
      else setError(result?.error ?? "Couldn't open billing just now.")
    })
  }

  if (plan === "free") {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          You&apos;re on the Free plan. Pro adds unlimited books, longer version history and beta-reader comments.
        </p>
        <Button className="w-fit" render={<Link href="/pricing" />} nativeButton={false}>
          See Pro plans
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-foreground">
        {status === "past_due"
          ? "Your last payment didn't go through. We're retrying it; update your payment method to keep Pro."
          : cancelAtPeriodEnd
            ? `Pro is cancelled and ends on ${renewsOn}. Everything you've written stays yours afterwards.`
            : `Pro renews on ${renewsOn}.`}
      </p>
      <div className="flex flex-wrap gap-2">
        {provider === "stripe" ? (
          <Button variant="outline" onClick={openPortal} disabled={pending}>
            Payment method &amp; invoices
          </Button>
        ) : null}
        {cancelAtPeriodEnd ? (
          provider === "stripe" ? (
            <Button onClick={() => run(resumeSubscriptionAction)} disabled={pending}>
              Keep Pro
            </Button>
          ) : null
        ) : (
          <Button variant="ghost" onClick={() => setConfirmCancel(true)} disabled={pending}>
            Cancel Pro
          </Button>
        )}
      </div>
      {provider === "razorpay" ? (
        <p className="text-xs text-muted-foreground">
          Payments are handled by Razorpay. Receipts arrive by email after each payment.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}

      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Pro?</AlertDialogTitle>
            <AlertDialogDescription>
              You keep Pro until {renewsOn}. After that nothing is deleted or locked: you can still open, edit
              and export everything, but you can&apos;t add more than the Free plan allows.
              {provider === "razorpay" ? " Razorpay subscriptions can't be resumed once cancelled; you can subscribe again later." : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setConfirmCancel(false)}>
              Keep Pro
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirmCancel(false)
                run(cancelSubscriptionAction)
              }}
            >
              Cancel at period end
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
