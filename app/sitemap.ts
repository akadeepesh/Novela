import type { MetadataRoute } from "next"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"

// Only the public marketing/auth routes belong here — everything under
// /dashboard and /projects is per-user and already excluded in robots.ts.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${APP_URL}/`, changeFrequency: "monthly", priority: 1 },
    { url: `${APP_URL}/pricing`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${APP_URL}/login`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${APP_URL}/signup`, changeFrequency: "yearly", priority: 0.5 },
  ]
}
