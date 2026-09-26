"use client"

import { useEffect, useState } from "react"
import { FeatherIcon } from "@phosphor-icons/react/dist/ssr"

const QUOTES = [
  "The first draft is you telling yourself the story.",
  "There is no greater agony than bearing an untold story inside you.",
  "Start writing, no matter what. The water does not flow until the faucet is turned on.",
  "You can always edit a bad page. You can't edit a blank page.",
  "A writer is someone for whom writing is more difficult than it is for other people.",
] as const

export function AuthBrandPanel() {
  const [quoteIndex, setQuoteIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setQuoteIndex((prev) => (prev + 1) % QUOTES.length)
    }, 8000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="manuscript-auth-panel hidden flex-1 flex-col justify-between p-12 lg:flex">
      <div className="flex items-center gap-2 text-manuscript-fg">
        <span className="flex size-9 items-center justify-center rounded-full bg-manuscript-fg/10">
          <FeatherIcon className="size-5" weight="duotone" />
        </span>
        <span className="font-heading text-lg font-semibold">KoraKagaj</span>
      </div>

      <blockquote className="relative font-serif text-xl leading-relaxed text-manuscript-fg/90 transition-opacity duration-500 sm:text-2xl">
        <span className="absolute -left-3 -top-2 text-4xl text-manuscript-fg/20">&ldquo;</span>
        {QUOTES[quoteIndex]}
      </blockquote>

      <div className="h-8" />
    </div>
  )
}
