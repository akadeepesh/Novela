/** A plain long-text page (privacy, terms). Child h2/p/a elements are styled here. */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <article className="mx-auto max-w-2xl px-6 pt-14 pb-8 sm:pt-20">
      <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated {updated}</p>
      <div className="mt-8 flex flex-col gap-4 leading-relaxed text-muted-foreground [&_a]:font-medium [&_a]:text-primary [&_a:hover]:underline [&_h2]:mt-6 [&_h2]:font-heading [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_strong]:text-foreground">
        {children}
      </div>
    </article>
  )
}
