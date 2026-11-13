import type { Metadata } from "next"
import Link from "next/link"
import { ArrowSquareOutIcon } from "@phosphor-icons/react/dist/ssr"
import { PageShell, PageShellHeader, PageShellTitle, PageShellDescription } from "@/components/layout/page-shell"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BUILTIN_TEMPLATES } from "@/lib/print/builtin-templates"
import { TEMPLATE_STORE_URL } from "@/lib/brand"

export const metadata: Metadata = {
  title: "Print templates",
  description: "Free print templates for Amazon KDP and IngramSpark paperbacks, and genre template packs.",
  alternates: { canonical: "/templates" },
}

export default function TemplatesPage() {
  return (
    <PageShell width="prose">
      <PageShellHeader>
        <PageShellTitle>Print templates</PageShellTitle>
        <PageShellDescription>
          Every book can be exported as a print-ready PDF for Amazon KDP or IngramSpark with the free
          templates. Template packs add more designs. Nothing in the app is ever locked.
        </PageShellDescription>
      </PageShellHeader>

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Free, built in</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            {BUILTIN_TEMPLATES.map((t) => (
              <div key={t.id}>
                <p className="font-medium text-foreground">{t.name}</p>
                <p className="text-muted-foreground">{t.description}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Template packs</CardTitle>
            <CardDescription>
              Designs by genre (fantasy, romance, thriller, literary and more) with matching fonts and
              ornaments. Buy once, keep forever. Import the pack file in Settings.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-start gap-3 text-sm">
            {TEMPLATE_STORE_URL ? (
              <Button render={<a href={TEMPLATE_STORE_URL} target="_blank" rel="noopener noreferrer" />} nativeButton={false}>
                Browse template packs
                <ArrowSquareOutIcon />
              </Button>
            ) : (
              <p className="text-muted-foreground">The template store is opening soon.</p>
            )}
            <Button size="sm" variant="ghost" render={<Link href="/settings" />} nativeButton={false}>
              Import a pack in Settings
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Make your own</CardTitle>
            <CardDescription>
              Templates are a documented JSON format with your own fonts and ornaments. Share them for
              free with other writers.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </PageShell>
  )
}
