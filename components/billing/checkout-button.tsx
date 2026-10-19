"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import type { BillingInterval, Currency } from "@/lib/billing/types"
import { confirmRazorpayCheckoutAction, startCheckoutAction } from "@/app/actions/billing"

const RAZORPAY_SCRIPT = "https://checkout.razorpay.com/v1/checkout.js"

type RazorpayResponse = {
  razorpay_payment_id: string
  razorpay_subscription_id: string
  razorpay_signature: string
}

type RazorpayCheckout = new (options: Record<string, unknown>) => { open: () => void }

declare global {
  interface Window {
    Razorpay?: RazorpayCheckout
  }
}

function loadRazorpay(): Promise<RazorpayCheckout> {
  if (window.Razorpay) return Promise.resolve(window.Razorpay)
  return new Promise((resolve, reject) => {
    const script = document.createElement("script")
    script.src = RAZORPAY_SCRIPT
    script.async = true
    script.onload = () => (window.Razorpay ? resolve(window.Razorpay) : reject(new Error("Razorpay unavailable")))
    script.onerror = () => reject(new Error("Couldn't load Razorpay"))
    document.body.appendChild(script)
  })
}

/**
 * "Upgrade to Pro". Rupee prices pay through Razorpay Checkout in a popup
 * (UPI, cards, netbanking); dollar prices go to Stripe's hosted checkout.
 */
export function CheckoutButton({
  currency,
  interval,
  signedIn,
  children,
}: {
  currency: Currency
  interval: BillingInterval
  signedIn: boolean
  children: React.ReactNode
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!signedIn) {
    return (
      <Button size="lg" className="w-full" render={<Link href="/signup" />} nativeButton={false}>
        {children}
      </Button>
    )
  }

  async function start() {
    setBusy(true)
    setError(null)
    const result = await startCheckoutAction({ currency, interval }).catch(() => null)
    if (!result || !result.ok) {
      setError(result?.error ?? "Couldn't start checkout. Please try again.")
      setBusy(false)
      return
    }
    if (result.kind === "redirect") {
      window.location.assign(result.url)
      return
    }

    try {
      const Razorpay = await loadRazorpay()
      new Razorpay({
        key: result.keyId,
        subscription_id: result.subscriptionId,
        name: "KoraKagaj",
        description: `Pro, billed ${interval === "year" ? "yearly" : "monthly"}`,
        prefill: { name: result.name, email: result.email },
        theme: { color: "#7c5c3b" },
        handler: async (response: RazorpayResponse) => {
          const confirmed = await confirmRazorpayCheckoutAction({
            paymentId: response.razorpay_payment_id,
            subscriptionId: response.razorpay_subscription_id,
            signature: response.razorpay_signature,
          }).catch(() => ({ ok: false }))
          // Even if this confirmation fails, the webhook will apply Pro shortly.
          router.push(confirmed.ok ? "/settings?checkout=success" : "/settings?checkout=processing")
        },
        modal: { ondismiss: () => setBusy(false) },
      }).open()
    } catch {
      setError("Couldn't open the payment window. Check your connection and try again.")
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button size="lg" className="w-full" onClick={start} disabled={busy}>
        {busy ? "Opening checkout…" : children}
      </Button>
      {error ? (
        <p role="alert" className="text-center text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}
