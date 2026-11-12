import type { MetadataRoute } from "next"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"

// Only public pages belong here. Everything under /dashboard and /projects
// is read from the visitor's own browser storage, so there is nothing to index.
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: `${APP_URL}/`, changeFrequency: "monthly", priority: 1 }]
}
