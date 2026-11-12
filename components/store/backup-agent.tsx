"use client"

import { useEffect } from "react"
import Dexie from "dexie"
import { DB_NAME } from "@/lib/store/db"
import { writeFolderBackup } from "@/lib/backup/folder"

/** Wait this long after the last change before writing a folder backup. */
const QUIET_MS = 60_000
/** But never wait longer than this during a long, unbroken writing session. */
const MAX_WAIT_MS = 10 * 60_000

/**
 * Keeps the backup folder (if one is chosen) up to date: after writing
 * stops for a minute, or when the tab is hidden, today's backup file is
 * rewritten. Changes to bookkeeping in the `meta` table don't count, or the
 * backup's own "last backed up" note would trigger another backup.
 */
export function BackupAgent() {
  useEffect(() => {
    let dirtySince: number | null = null
    let timer: ReturnType<typeof setTimeout> | undefined

    async function flush() {
      if (dirtySince === null) return
      dirtySince = null
      clearTimeout(timer)
      const run = () => writeFolderBackup().catch((err) => console.error("Folder backup failed", err))
      // One tab at a time, when several are open.
      if (navigator.locks) await navigator.locks.request("folder-backup", run)
      else await run()
    }

    function onMutated(parts: Record<string, unknown>) {
      const prefix = `idb://${DB_NAME}/`
      const real = Object.keys(parts).some((key) => key.startsWith(prefix) && !key.startsWith(`${prefix}meta/`))
      if (!real) return
      const now = Date.now()
      dirtySince ??= now
      clearTimeout(timer)
      const wait = Math.min(QUIET_MS, Math.max(0, dirtySince + MAX_WAIT_MS - now))
      timer = setTimeout(() => void flush(), wait)
    }

    function onHide() {
      if (document.visibilityState === "hidden") void flush()
    }

    Dexie.on("storagemutated", onMutated)
    document.addEventListener("visibilitychange", onHide)
    return () => {
      Dexie.on("storagemutated").unsubscribe(onMutated)
      document.removeEventListener("visibilitychange", onHide)
      clearTimeout(timer)
    }
  }, [])
  return null
}
