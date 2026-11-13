import Link from "next/link"
import { FaqList, JsonLd, StartButton, type Faq } from "./blocks"
import { GUIDE_LINKS } from "./site-chrome"
import { APP_NAME } from "@/lib/brand"

export type GuideSection = {
  heading: string
  /** Paragraphs, in order. */
  body?: string[]
  /** An optional list after the paragraphs. */
  points?: { title?: string; text: string }[]
}

/**
 * A page written for one search ("free Scrivener alternative"): a direct
 * answer up top, honest detail below, questions, and links to the others.
 */
export function GuidePage({
  path,
  eyebrow,
  title,
  intro,
  sections,
  faq,
  children,
}: {
  path: string
  eyebrow: string
  title: string
  intro: string
  sections: GuideSection[]
  faq: Faq[]
  /** Extra content after the sections (a table, images). */
  children?: React.ReactNode
}) {
  return (
    <article className="mx-auto max-w-3xl px-6 pt-14 pb-8 sm:pt-20">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: title,
          description: intro,
          mainEntityOfPage: path,
          publisher: { "@type": "Organization", name: APP_NAME },
        }}
      />
      <p className="mb-3 text-sm font-medium text-primary">{eyebrow}</p>
      <h1 className="font-heading text-3xl leading-tight font-semibold tracking-tight text-foreground sm:text-4xl">{title}</h1>
      <p className="mt-5 font-serif text-lg leading-relaxed text-muted-foreground">{intro}</p>
      <div className="mt-7">
        <StartButton />
      </div>

      <div className="mt-14 flex flex-col gap-12">
        {sections.map((s) => (
          <section key={s.heading}>
            <h2 className="font-heading text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{s.heading}</h2>
            {s.body?.map((p, i) => (
              <p key={i} className="mt-3 leading-relaxed text-muted-foreground">
                {p}
              </p>
            ))}
            {s.points ? (
              <ul className="mt-4 flex flex-col gap-2.5">
                {s.points.map((pt, i) => (
                  <li key={i} className="flex gap-2.5 leading-relaxed text-muted-foreground">
                    <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                    <span>
                      {pt.title ? <span className="font-medium text-foreground">{pt.title}. </span> : null}
                      {pt.text}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
      </div>

      {children ? <div className="mt-12">{children}</div> : null}

      <section className="mt-16">
        <h2 className="mb-6 font-heading text-xl font-semibold tracking-tight text-foreground sm:text-2xl">Questions</h2>
        <FaqList items={faq} />
      </section>

      <section className="mt-16 rounded-xl bg-muted/40 p-6 text-center">
        <p className="font-heading text-xl font-semibold text-foreground">Try it now. It takes a second.</p>
        <p className="mt-2 text-sm text-muted-foreground">Free, no account, and your book stays on your device.</p>
        <div className="mt-5 flex justify-center">
          <StartButton />
        </div>
      </section>

      <nav aria-label="More guides" className="mt-12 text-sm">
        <p className="mb-2 font-medium text-foreground">More guides</p>
        <ul className="flex flex-wrap gap-x-5 gap-y-1.5">
          {GUIDE_LINKS.filter((l) => l.href !== path).map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="text-primary hover:underline">
                {l.label}
              </Link>
            </li>
          ))}
          <li>
            <Link href="/" className="text-primary hover:underline">
              {APP_NAME} home
            </Link>
          </li>
        </ul>
      </nav>
    </article>
  )
}
