// app/manifest.ts
import type { MetadataRoute } from "next"
import { APP_NAME, DESCRIPTION } from "@/lib/brand"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: APP_NAME,
    description: DESCRIPTION,
    id: "/",
    // Installed, the app opens straight to your books.
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    categories: ["productivity", "books"],
    background_color: "#fcfaf7",
    theme_color: "#8e5138",
    icons: [
      { src: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Padded so the nib stays inside the circle Android may crop to.
      { src: "/maskable-192x192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/maskable-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
}
