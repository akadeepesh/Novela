import Script from "next/script"

/**
 * Cookieless page-view analytics for the public pages only (landing,
 * guides, legal). Nothing loads unless both variables are set, and the
 * writing app (/dashboard, /projects, /settings, /read) never includes
 * this component, so nothing a writer types can be seen by it.
 *
 * Works with any script that takes the site in `data-domain`
 * (Plausible, self-hosted Plausible) or `data-website-id` (Umami).
 */
export function Analytics() {
  const src = process.env.NEXT_PUBLIC_ANALYTICS_SRC
  const site = process.env.NEXT_PUBLIC_ANALYTICS_DOMAIN
  if (!src || !site) return null
  const umami = /umami/i.test(src)
  return (
    <Script
      src={src}
      strategy="afterInteractive"
      {...(umami ? { "data-website-id": site } : { "data-domain": site })}
    />
  )
}
