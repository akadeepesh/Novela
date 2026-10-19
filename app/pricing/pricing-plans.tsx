"use client"

import { useState } from "react"
import Link from "next/link"
import { CheckIcon } from "@phosphor-icons/react/dist/ssr"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { CheckoutButton } from "@/components/billing/checkout-button"
import { PLANS, PRO_PRICES, type PlanId } from "@/lib/plans"
import type { BillingInterval, Currency } from "@/lib/billing/types"

const free = PLANS.free.features
const pro = PLANS.pro.features
const MB = 1024 * 1024

function storage(bytes: number) {
  return bytes >= 1024 * MB ? `${bytes / (1024 * MB)} GB` : `${bytes / MB} MB`
}

const FREE_POINTS = [
  `${free.limits.projects} active books`,
  `Up to ${free.limits.chapters} chapters per book`,
  "Full editor, focus mode, @mentions and story bible",
  `${free.autoVersions} autosaved versions per chapter, ${free.manualVersions} saved versions`,
  "PDF, EPUB and Word export, no watermark",
  `${free.shareLinks} beta-reader link per book`,
  `${storage(free.storageBytes)} for covers and images`,
]

const PRO_POINTS = [
  "Unlimited books and chapters",
  "Unlimited characters, world, plot, notes and research",
  `${pro.autoVersions} autosaved versions per chapter, unlimited saved versions`,
  "Every print trim size for PDF export",
  "Beta-reader links with comments, passwords and expiry",
  `${storage(pro.storageBytes)} for covers and images`,
  "Support an independent writing tool",
]

export function PricingPlans({
  defaultCurrency,
  signedIn,
  currentPlan,
}: {
  defaultCurrency: Currency
  signedIn: boolean
  currentPlan: PlanId | null
}) {
  const [currency, setCurrency] = useState<Currency>(defaultCurrency)
  const [interval, setInterval] = useState<BillingInterval>("year")
  const price = PRO_PRICES[currency]
  const monthlyEquivalent = Math.round((price.year / 12) * 100) / 100
  const saving = Math.round((1 - price.year / (price.month * 12)) * 100)

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Toggle
          options={[
            { value: "month", label: "Monthly" },
            { value: "year", label: `Yearly · save ${saving}%` },
          ]}
          value={interval}
          onChange={(v) => setInterval(v as BillingInterval)}
          label="Billing period"
        />
        <Toggle
          options={[
            { value: "INR", label: "₹ INR" },
            { value: "USD", label: "$ USD" },
          ]}
          value={currency}
          onChange={(v) => setCurrency(v as Currency)}
          label="Currency"
        />
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <PlanCard
          name="Free"
          price={`${price.symbol}0`}
          cadence="forever"
          blurb="Everything you need to write a whole book."
          points={FREE_POINTS}
          action={
            currentPlan === "free" ? (
              <Button size="lg" variant="outline" className="w-full" disabled>
                Your current plan
              </Button>
            ) : currentPlan === "pro" ? null : (
              <Button size="lg" variant="outline" className="w-full" render={<Link href="/signup" />} nativeButton={false}>
                Start writing free
              </Button>
            )
          }
        />
        <PlanCard
          highlighted
          name="Pro"
          price={`${price.symbol}${interval === "year" ? price.year.toLocaleString() : price.month}`}
          cadence={interval === "year" ? `per year · ${price.symbol}${monthlyEquivalent}/month` : "per month"}
          blurb="For writers with several books on the go, and their beta readers."
          points={PRO_POINTS}
          action={
            currentPlan === "pro" ? (
              <Button size="lg" variant="outline" className="w-full" render={<Link href="/settings" />} nativeButton={false}>
                Manage your plan
              </Button>
            ) : (
              <CheckoutButton currency={currency} interval={interval} signedIn={signedIn}>
                Upgrade to Pro
              </CheckoutButton>
            )
          }
        />
      </div>

      <p className="text-center text-xs text-muted-foreground">
        {currency === "INR"
          ? "Paid securely with Razorpay: UPI Autopay, cards or netbanking."
          : "Paid securely with Stripe."}{" "}
        Cancel any time.
      </p>
    </div>
  )
}

function Toggle({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
  label: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-full border border-border bg-card p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
            value === o.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function PlanCard({
  name,
  price,
  cadence,
  blurb,
  points,
  action,
  highlighted = false,
}: {
  name: string
  price: string
  cadence: string
  blurb: string
  points: string[]
  action: React.ReactNode
  highlighted?: boolean
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-5 rounded-2xl border bg-card p-6 shadow-xs",
        highlighted ? "border-primary/50 ring-1 ring-primary/30" : "border-border"
      )}
    >
      <div className="flex flex-col gap-1">
        <p className="font-heading text-lg font-semibold text-foreground">{name}</p>
        <p className="text-sm text-muted-foreground">{blurb}</p>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="font-heading text-4xl font-semibold tracking-tight text-foreground">{price}</span>
        <span className="text-sm text-muted-foreground">{cadence}</span>
      </div>
      <ul className="flex flex-1 flex-col gap-2.5">
        {points.map((p) => (
          <li key={p} className="flex items-start gap-2 text-sm text-foreground">
            <CheckIcon className="mt-0.5 size-4 shrink-0 text-primary" weight="bold" />
            {p}
          </li>
        ))}
      </ul>
      {action}
    </div>
  )
}
