// app/manifest.ts
import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "KoraKagaj",
    short_name: "KoraKagaj",
    description: "A focused writing workspace for novelists, poets, and storytellers.",
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
