import type { Metadata } from "next"
import Link from "next/link"
import { headers } from "next/headers"
import { FeatherIcon } from "@phosphor-icons/react/dist/ssr"
import { auth } from "@/auth"
import { getEntitlements } from "@/lib/entitlements"
import { PricingPlans } from "./pricing-plans"

export const metadata: Metadata = {
  title: "Pricing",
  description: "KoraKagaj is free for writing a whole book. Pro adds unlimited books, beta-reader comments and more.",
}

const FAQ = [
  {
    q: "What happens to my writing if I cancel or stop paying?",
    a: "Nothing is ever locked or deleted. You keep Pro until the end of the period you paid for. After that, everything you wrote stays editable and exportable; you just can't create more than the Free plan allows until you're back under its limits.",
  },
  {
    q: "Can I export my book on the Free plan?",
    a: "Yes. PDF, EPUB and Word, with no watermark, at 6 × 9 in and US Letter. Pro adds the other print trim sizes.",
  },
  {
    q: "Which currency will I pay in?",
    a: "Writers in India pay in rupees through Razorpay (UPI Autopay, cards, netbanking). Everyone else pays in US dollars through Stripe. You can switch above.",
  },
]

export default async function PricingPage() {
  const session = await auth()
  const userId = session?.user?.id
  const currentPlan = userId ? (await getEntitlements(userId)).plan : null
  // Set by Vercel at the edge. Elsewhere it's absent and everyone starts on USD.
  const country = (await headers()).get("x-vercel-ip-country")

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between px-6 py-5 sm:px-10">
        <Link href={userId ? "/dashboard" : "/"} className="flex items-center gap-2 text-foreground">
          <FeatherIcon className="size-4 text-primary" weight="duotone" />
          <span className="font-heading text-sm font-semibold">KoraKagaj</span>
        </Link>
        {userId ? null : (
          <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground">
            Sign in
          </Link>
        )}
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-col gap-12 px-6 pb-24 sm:px-10">
        <div className="flex flex-col items-center gap-3 pt-6 text-center">
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Write for free. Go Pro when your shelf grows.
          </h1>
          <p className="max-w-xl font-serif text-lg text-muted-foreground">
            The whole writing experience is free. Pro is for more books, longer history, and sharing drafts with
            beta readers.
          </p>
        </div>

        <PricingPlans
          defaultCurrency={country === "IN" ? "INR" : "USD"}
          signedIn={Boolean(userId)}
          currentPlan={currentPlan}
        />

        <section className="mx-auto flex w-full max-w-2xl flex-col gap-6">
          <h2 className="font-heading text-xl font-semibold text-foreground">Questions</h2>
          {FAQ.map(({ q, a }) => (
            <div key={q} className="flex flex-col gap-1.5">
              <h3 className="text-sm font-medium text-foreground">{q}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{a}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  )
}
