import Link from "next/link"
import { Button } from "@/components/ui/button"
import { BrandMark } from "@/components/brand-mark"
import { APP_NAME, DONATE_URL, REPO_URL } from "@/lib/brand"

/** Pages written for search: what people look for, and where it lives. */
export const GUIDE_LINKS = [
  { href: "/free-scrivener-alternative", label: "Free Scrivener alternative" },
  { href: "/free-novel-writing-software", label: "Free novel writing software" },
  { href: "/kdp-formatting-free", label: "Free KDP book formatting" },
  { href: "/story-bible-app", label: "Story bible app" },
]

/** The public pages' top bar. */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-6">
        <Link href="/" className="flex items-center gap-2 font-heading font-semibold text-foreground">
          <BrandMark size={22} />
          {APP_NAME}
        </Link>
        <nav aria-label="Main" className="flex items-center gap-1 text-sm">
          <Link href="/#features" className="hidden rounded-md px-2.5 py-1.5 text-muted-foreground hover:text-foreground sm:inline">
            Features
          </Link>
          <Link href="/#compare" className="hidden rounded-md px-2.5 py-1.5 text-muted-foreground hover:text-foreground sm:inline">
            Compare
          </Link>
          <Link href="/templates" className="hidden rounded-md px-2.5 py-1.5 text-muted-foreground hover:text-foreground md:inline">
            Templates
          </Link>
          <Button size="sm" className="ml-2" render={<Link href="/dashboard" />} nativeButton={false}>
            Start writing
          </Button>
        </nav>
      </div>
    </header>
  )
}

/** The public pages' footer. */
export function SiteFooter() {
  const year = new Date().getFullYear()
  return (
    <footer className="mt-24 border-t border-border/60 bg-muted/30">
      <div className="mx-auto grid max-w-6xl gap-8 px-6 py-12 text-sm sm:grid-cols-3">
        <div className="flex flex-col gap-2">
          <p className="flex items-center gap-2 font-heading font-semibold text-foreground">
            <BrandMark size={18} />
            {APP_NAME}
          </p>
          <p className="text-muted-foreground">
            Free novel writing software. Your book stays on your device. No account, no AI.
          </p>
        </div>
        <nav aria-label="Guides" className="flex flex-col gap-1.5">
          <p className="font-medium text-foreground">Guides</p>
          {GUIDE_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="text-muted-foreground hover:text-foreground">
              {l.label}
            </Link>
          ))}
        </nav>
        <nav aria-label="About" className="flex flex-col gap-1.5">
          <p className="font-medium text-foreground">About</p>
          <Link href="/templates" className="text-muted-foreground hover:text-foreground">
            Print templates
          </Link>
          <Link href="/privacy" className="text-muted-foreground hover:text-foreground">
            Privacy
          </Link>
          <Link href="/terms" className="text-muted-foreground hover:text-foreground">
            Terms
          </Link>
          {REPO_URL ? (
            <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
              Source code
            </a>
          ) : null}
          {DONATE_URL ? (
            <a href={DONATE_URL} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
              Support the project on Ko-fi
            </a>
          ) : null}
        </nav>
      </div>
      <p className="pb-8 text-center text-xs text-muted-foreground">© {year} {APP_NAME}</p>
    </footer>
  )
}
