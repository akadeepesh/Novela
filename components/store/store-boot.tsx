"use client"

import { useEffect } from "react"
import { requestPersistentStorage } from "@/lib/store/persist"
import { purgeExpiredTrash } from "@/lib/store/projects"

/**
 * Runs once per page load: asks the browser to keep our storage, and
 * empties Trash items older than the retention period.
 */
export function StoreBoot() {
  useEffect(() => {
    void requestPersistentStorage()
    purgeExpiredTrash().catch((err) => console.error("purgeExpiredTrash failed", err))
  }, [])
  return null
}
