import Image from "next/image"
import Link from "next/link"
import { CheckIcon } from "@phosphor-icons/react/dist/ssr"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { BUILTIN_TEMPLATES } from "@/lib/print/builtin-templates"
import { COMPARISON_APPS, COMPARISON_CHECKED, COMPARISON_ROWS, OTHERS_ARE_BETTER } from "@/lib/marketing/comparison"
import { APP_NAME, TEMPLATE_STORE_URL } from "@/lib/brand"

/** Structured data for search engines. `<` is escaped so the JSON can't close the script tag. */
export function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />
}

export function Section({ id, eyebrow, title, intro, children, className }: {
  id?: string
  eyebrow?: string
  title: string
  intro?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section id={id} className={cn("mx-auto max-w-6xl scroll-mt-20 px-6 py-16 sm:py-20", className)}>
      <div className="mb-10 max-w-2xl">
        {eyebrow ? <p className="mb-2 text-sm font-medium text-primary">{eyebrow}</p> : null}
        <h2 className="font-heading text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{title}</h2>
        {intro ? <div className="mt-3 text-base leading-relaxed text-muted-foreground">{intro}</div> : null}
      </div>
      {children}
    </section>
  )
}

export function StartButton({ children = "Start writing, free" }: { children?: React.ReactNode }) {
  return (
    <Button size="lg" className="h-11 px-5 text-base" render={<Link href="/dashboard" />} nativeButton={false}>
      {children}
    </Button>
  )
}

export function ComparisonTable() {
  return (
    <div>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <caption className="sr-only">
            {APP_NAME} compared with Scrivener, Novelcrafter and Campfire, checked {COMPARISON_CHECKED}
          </caption>
          <thead>
            <tr className="bg-muted/50">
              <th scope="col" className="w-44 p-3 font-medium text-muted-foreground">
                <span className="sr-only">Feature</span>
              </th>
              {COMPARISON_APPS.map((app, i) => (
                <th key={app} scope="col" className={cn("p-3 font-heading font-semibold text-foreground", i === 0 && "bg-primary/10")}>
                  {app}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COMPARISON_ROWS.map((row) => (
              <tr key={row.label} className="border-t border-border align-top">
                <th scope="row" className="p-3 font-medium text-foreground">
                  {row.label}
                </th>
                {row.cells.map((cell, i) => (
                  <td key={i} className={cn("p-3 text-muted-foreground", i === 0 && "bg-primary/5 text-foreground")}>
                    <span className="flex gap-1.5">
                      {cell.good ? <CheckIcon className="mt-0.5 size-4 shrink-0 text-emerald-600" weight="bold" aria-label="Good" /> : null}
                      {cell.text}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Prices and features checked {COMPARISON_CHECKED} on each app&apos;s own website. They change, so check before you buy.
      </p>
      <div className="mt-6 rounded-xl bg-muted/40 p-5 text-sm">
        <p className="mb-2 font-medium text-foreground">Where the others are better</p>
        <ul className="flex flex-col gap-1.5 text-muted-foreground">
          {OTHERS_ARE_BETTER.map((o) => (
            <li key={o.app}>
              <span className="font-medium text-foreground">{o.app}:</span> {o.text}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export function TemplateShowcase() {
  return (
    <div>
      <div className="grid gap-6 sm:grid-cols-3">
        {BUILTIN_TEMPLATES.map((t) => (
          <figure key={t.id} className="flex flex-col gap-3">
            <div className="overflow-hidden rounded-lg border border-border bg-white shadow-md shadow-foreground/5">
              <Image
                src={`/landing/template-${t.id}.webp`}
                alt={`A chapter opening page in the ${t.name} template`}
                width={640}
                height={959}
                sizes="(min-width: 640px) 33vw, 100vw"
                className="h-auto w-full"
              />
            </div>
            <figcaption>
              <p className="font-medium text-foreground">{t.name}</p>
              <p className="text-sm text-muted-foreground">{t.description}</p>
            </figcaption>
          </figure>
        ))}
      </div>
      <div className="mt-8 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <Button variant="outline" render={<Link href="/templates" />} nativeButton={false}>
          More templates
        </Button>
        <span>
          {TEMPLATE_STORE_URL
            ? "Genre template packs are a one-time purchase. Everything else is free."
            : "Genre template packs (fantasy, romance, thriller and more) are coming soon, as a one-time purchase."}
        </span>
      </div>
    </div>
  )
}

export type Faq = { q: string; a: string }

/** Questions and answers, plus matching FAQPage structured data. */
export function FaqList({ items }: { items: Faq[] }) {
  return (
    <>
      <dl className="grid gap-x-10 gap-y-6 sm:grid-cols-2">
        {items.map((f) => (
          <div key={f.q}>
            <dt className="font-medium text-foreground">{f.q}</dt>
            <dd className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.a}</dd>
          </div>
        ))}
      </dl>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: items.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
        }}
      />
    </>
  )
}
