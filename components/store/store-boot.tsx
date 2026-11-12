"use client"

import { useEffect } from "react"
import { requestPersistentStorage } from "@/lib/store/persist"
import { purgeExpiredTrash } from "@/lib/store/projects"

/**
 * Runs once per page load: asks the browser to keep our storage, empties
 * Trash items older than the retention period, and installs the service
 * worker that makes the app open offline (production builds only, so it
 * never serves stale code during development).
 */
export function StoreBoot() {
  useEffect(() => {
    void requestPersistentStorage()
    purgeExpiredTrash().catch((err) => console.error("purgeExpiredTrash failed", err))
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((err) => {
        console.error("Service worker registration failed", err)
      })
    }
  }, [])
  return null
}
