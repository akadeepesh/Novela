"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useLiveQuery } from "dexie-react-hooks"
import { ShieldCheckIcon } from "@phosphor-icons/react/dist/ssr"
import { Button } from "@/components/ui/button"
import { relativeTime } from "@/lib/format"
import { downloadFullBackup } from "@/lib/backup/download"
import { getBackupStatus, snoozeReminder } from "@/lib/backup/status"

/** A gentle nudge on the dashboard when nothing has been backed up for a week. */
export function BackupReminder() {
  const status = useLiveQuery(getBackupStatus, [])
  const [busy, startBusy] = useTransition()
  const [failed, setFailed] = useState(false)
  if (!status?.reminderDue) return null

  return (
    <div className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
      <ShieldCheckIcon className="size-4 shrink-0 text-primary" />
      <p className="min-w-0 flex-1 text-foreground">
        {status.lastBackupAt
          ? `Your last backup was ${relativeTime(status.lastBackupAt)}.`
          : "You haven't backed up your writing yet."}{" "}
        <span className="text-muted-foreground">It only lives in this browser.</span>
        {failed ? <span className="text-destructive"> Couldn&apos;t make the backup. Try again.</span> : null}
      </p>
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          disabled={busy}
          onClick={() =>
            startBusy(async () => {
              setFailed(false)
              await downloadFullBackup().catch(() => setFailed(true))
            })
          }
        >
          {busy ? "Preparing…" : "Back up now"}
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => void snoozeReminder()}>
          Later
        </Button>
        <Button size="sm" variant="ghost" render={<Link href="/settings" />} nativeButton={false}>
          Options
        </Button>
      </div>
    </div>
  )
}
