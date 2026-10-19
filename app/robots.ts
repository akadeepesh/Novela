import type { MetadataRoute } from "next"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"

// Everything past the marketing/auth pages is a signed-in writer's private
// workspace — there's nothing for a crawler to index there, and letting
// bots wander into it just burns crawl budget.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // /s/ is private beta-reader links (also marked noindex).
      disallow: ["/dashboard", "/projects", "/settings", "/read", "/api", "/s/"],
    },
    sitemap: `${APP_URL}/sitemap.xml`,
  }
}
