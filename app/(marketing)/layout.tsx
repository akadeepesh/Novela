import { SiteFooter, SiteHeader } from "@/components/marketing/site-chrome"
import { Analytics } from "@/components/marketing/analytics"

/** The public pages: landing, guides and legal. The writing app has its own layouts. */
export default function MarketingLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
      <Analytics />
    </div>
  )
}
