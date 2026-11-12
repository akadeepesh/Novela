// app/manifest.ts
import type { MetadataRoute } from "next"
import { APP_NAME, DESCRIPTION } from "@/lib/brand"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: APP_NAME,
    description: DESCRIPTION,
    start_url: "/",
    display: "standalone",
    background_color: "#fcfaf7",
    theme_color: "#8e5138",
    icons: [
      { src: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
}
