"use client"

import { useState, useTransition } from "react"
import { useLiveQuery } from "dexie-react-hooks"
import { DownloadSimpleIcon, FolderSimpleIcon } from "@phosphor-icons/react/dist/ssr"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { relativeTime } from "@/lib/format"
import { downloadFullBackup } from "@/lib/backup/download"
import { getBackupStatus } from "@/lib/backup/status"
import {
  KEEP_DAYS,
  chooseBackupFolder,
  forgetBackupFolder,
  getFolderStatus,
  reconnectBackupFolder,
  writeFolderBackup,
} from "@/lib/backup/folder"
import { ImportButton } from "./import-button"

export function BackupPanel() {
  const status = useLiveQuery(getBackupStatus, [])
  const [downloading, startDownload] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function download() {
    setError(null)
    startDownload(async () => {
      try {
        await downloadFullBackup()
      } catch (err) {
        console.error("backup failed", err)
        setError("Couldn't make the backup. Please try again.")
      }
    })
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Backups</CardTitle>
          <CardDescription>
            A backup is one file with every book, its history and its images. Keep it somewhere
            safe, like a cloud drive or a USB stick.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-start gap-4 text-sm">
          {status ? (
            <p className="text-foreground">
              {status.lastBackupAt
                ? `Last backed up ${relativeTime(status.lastBackupAt)}${status.lastBackupVia === "folder" ? " to your folder" : ""}.`
                : "Not backed up yet."}
            </p>
          ) : null}
          <div className="flex flex-wrap items-start gap-2">
            <Button size="sm" onClick={download} disabled={downloading}>
              <DownloadSimpleIcon />
              {downloading ? "Preparing…" : "Download a backup"}
            </Button>
            <ImportButton label="Restore from a file" />
          </div>
          {error ? (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Restoring adds the books in the file. Books you already have are only changed if you
            choose to replace them.
          </p>
        </CardContent>
      </Card>
      <FolderBackupCard />
    </>
  )
}

function FolderBackupCard() {
  // Permission isn't stored in the database, so a manual tick re-reads it.
  const [tick, setTick] = useState(0)
  const folder = useLiveQuery(getFolderStatus, [tick])
  const [busy, startBusy] = useTransition()
  const [message, setMessage] = useState<string | null>(null)

  function run(action: () => Promise<unknown>) {
    setMessage(null)
    startBusy(async () => {
      const result = await action()
      if (result && typeof result === "object" && "error" in result && result.error) {
        setMessage(String(result.error))
      }
      setTick((t) => t + 1)
    })
  }

  if (!folder) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Automatic folder backup</CardTitle>
        <CardDescription>
          Pick a folder (for example one inside Dropbox, iCloud Drive or OneDrive) and a backup is
          saved there a minute after you stop writing. The last {KEEP_DAYS} days are kept.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-start gap-3 text-sm">
        {folder.state === "unsupported" ? (
          <p className="text-muted-foreground">
            This browser can&apos;t save to a folder. Chrome and Edge can. Here, use{" "}
            <span className="font-medium text-foreground">Download a backup</span> regularly instead.
          </p>
        ) : folder.state === "none" ? (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => run(chooseBackupFolder)}>
            <FolderSimpleIcon />
            Choose a folder
          </Button>
        ) : folder.state === "needs-permission" ? (
          <>
            <p className="text-foreground">
              Backing up to <span className="font-medium">{folder.name}</span> is paused. The browser
              needs your permission again.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={busy}
                onClick={() => run(async () => ((await reconnectBackupFolder()) ? writeFolderBackup() : undefined))}
              >
                Allow and back up now
              </Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(forgetBackupFolder)}>
                Stop folder backups
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-foreground">
              Backing up to <span className="font-medium">{folder.name}</span>.{" "}
              {folder.lastWriteAt ? `Last saved ${relativeTime(folder.lastWriteAt)}.` : null}
            </p>
            {folder.lastError ? <p className="text-destructive">{folder.lastError}</p> : null}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" disabled={busy} onClick={() => run(writeFolderBackup)}>
                {busy ? "Saving…" : "Back up now"}
              </Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(chooseBackupFolder)}>
                Change folder
              </Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(forgetBackupFolder)}>
                Stop
              </Button>
            </div>
          </>
        )}
        {message ? (
          <p role="alert" className="text-destructive">
            {message}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
