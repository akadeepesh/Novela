import type { MetadataRoute } from "next"
import { SITE_URL } from "@/lib/brand"

const APP_URL = SITE_URL

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
