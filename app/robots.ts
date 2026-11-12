import type { MetadataRoute } from "next"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"

// Everything past the landing page is the writer's own workspace, read from
// their browser storage. There is nothing for a crawler to index there.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/projects", "/settings", "/read"],
    },
    sitemap: `${APP_URL}/sitemap.xml`,
  }
}
