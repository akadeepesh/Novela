import { db } from "@/lib/store/db"

/** Small bookkeeping values kept in the `meta` table. */
const KEYS = {
  lastBackupAt: "backup.lastAt",
  lastBackupVia: "backup.lastVia",
  reminderSnoozedUntil: "backup.snoozedUntil",
  folderHandle: "backup.folderHandle",
  folderLastWriteAt: "backup.folderLastWriteAt",
  folderLastError: "backup.folderLastError",
} as const

export type BackupVia = "download" | "folder"

export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await db().meta.get(key))?.value as T | undefined
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await db().meta.put({ key, value })
}

export async function deleteMeta(key: string): Promise<void> {
  await db().meta.delete(key)
}

export { KEYS as META_KEYS }

/** Records that everything was just backed up (a full backup download or a folder write). */
export async function recordBackup(via: BackupVia): Promise<void> {
  const now = new Date().toISOString()
  await db().meta.bulkPut([
    { key: KEYS.lastBackupAt, value: now },
    { key: KEYS.lastBackupVia, value: via },
  ])
}

/** How long without a backup before the dashboard suggests one. */
export const REMINDER_AFTER_DAYS = 7
/** "Remind me later" hides the banner for this long. */
export const SNOOZE_DAYS = 3
const DAY_MS = 24 * 60 * 60 * 1000

export type BackupStatus = {
  lastBackupAt: string | null
  lastBackupVia: BackupVia | null
  /** True when the dashboard should show the backup reminder. */
  reminderDue: boolean
}

/**
 * Reads the backup status. The reminder is due when there is writing to
 * protect and nothing has been backed up for REMINDER_AFTER_DAYS: counted
 * from the last backup, or for someone who never backed up, from when their
 * first book was created (so brand-new writers aren't nagged on day one).
 */
export async function getBackupStatus(): Promise<BackupStatus> {
  const d = db()
  const [last, via, snoozed, projects] = await Promise.all([
    getMeta<string>(KEYS.lastBackupAt),
    getMeta<BackupVia>(KEYS.lastBackupVia),
    getMeta<string>(KEYS.reminderSnoozedUntil),
    d.projects.toArray(),
  ])
  const live = projects.filter((p) => !p.deletedAt)
  const now = Date.now()
  const since = last ?? live.map((p) => p.createdAt).sort()[0]
  const stale = since ? now - new Date(since).getTime() >= REMINDER_AFTER_DAYS * DAY_MS : false
  const isSnoozed = snoozed ? new Date(snoozed).getTime() > now : false
  return {
    lastBackupAt: last ?? null,
    lastBackupVia: via ?? null,
    reminderDue: live.length > 0 && stale && !isSnoozed,
  }
}

export async function snoozeReminder(): Promise<void> {
  await setMeta(KEYS.reminderSnoozedUntil, new Date(Date.now() + SNOOZE_DAYS * DAY_MS).toISOString())
}
