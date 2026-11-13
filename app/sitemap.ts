import type { MetadataRoute } from "next"
import { GUIDE_LINKS } from "@/components/marketing/site-chrome"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"

// Only public pages belong here. Everything under /dashboard and /projects
// is read from the visitor's own browser storage, so there is nothing to index.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${APP_URL}/`, changeFrequency: "monthly", priority: 1 },
    ...GUIDE_LINKS.map((l) => ({ url: `${APP_URL}${l.href}`, changeFrequency: "monthly" as const, priority: 0.8 })),
    { url: `${APP_URL}/templates`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${APP_URL}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${APP_URL}/terms`, changeFrequency: "yearly", priority: 0.3 },
  ]
}
