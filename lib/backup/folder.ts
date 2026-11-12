import { APP_NAME, BACKUP_FILE_EXTENSION } from "@/lib/brand"
import { createBackup } from "./format"
import { fullBackupFileName, localDate, slugify } from "./download"
import { META_KEYS, deleteMeta, getMeta, recordBackup, setMeta } from "./status"

/**
 * Automatic backups to a folder the writer picks (for example one inside
 * Dropbox, iCloud Drive or OneDrive, which then syncs it). Uses the File
 * System Access API, which only Chromium browsers (Chrome, Edge, Opera,
 * Brave) offer; elsewhere the Settings page explains how to download
 * backups instead.
 *
 * One file is written per day (later writes that day replace it) and only
 * the newest KEEP_DAYS daily files are kept.
 */

export const KEEP_DAYS = 7

// Not yet in TypeScript's DOM types.
type PermissionMode = { mode: "readwrite" }
type PermissionHandle = FileSystemDirectoryHandle & {
  queryPermission(options: PermissionMode): Promise<PermissionState>
  requestPermission(options: PermissionMode): Promise<PermissionState>
  keys(): AsyncIterable<string>
}
type PickerWindow = Window & {
  showDirectoryPicker(options?: { id?: string; mode?: "readwrite"; startIn?: string }): Promise<FileSystemDirectoryHandle>
}

export function isFolderBackupSupported(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window
}

export type FolderStatus =
  | { state: "unsupported" }
  | { state: "none" }
  /** A folder is chosen but the browser needs a click to allow writing again. */
  | { state: "needs-permission"; name: string }
  | { state: "ready"; name: string; lastWriteAt: string | null; lastError: string | null }

async function storedHandle(): Promise<PermissionHandle | undefined> {
  return getMeta<PermissionHandle>(META_KEYS.folderHandle)
}

export async function getFolderStatus(): Promise<FolderStatus> {
  if (!isFolderBackupSupported()) return { state: "unsupported" }
  const handle = await storedHandle()
  if (!handle) return { state: "none" }
  let permission: PermissionState
  try {
    permission = await handle.queryPermission({ mode: "readwrite" })
  } catch {
    permission = "prompt"
  }
  if (permission !== "granted") return { state: "needs-permission", name: handle.name }
  const [lastWriteAt, lastError] = await Promise.all([
    getMeta<string>(META_KEYS.folderLastWriteAt),
    getMeta<string>(META_KEYS.folderLastError),
  ])
  return { state: "ready", name: handle.name, lastWriteAt: lastWriteAt ?? null, lastError: lastError ?? null }
}

/** Asks the writer to pick a folder, remembers it, and writes a first backup. Must run from a click. */
export async function chooseBackupFolder(): Promise<{ ok: true } | { ok: false; error?: string }> {
  if (!isFolderBackupSupported()) return { ok: false, error: "This browser can't save to a folder." }
  let handle: FileSystemDirectoryHandle
  try {
    handle = await (window as unknown as PickerWindow).showDirectoryPicker({ id: "backups", mode: "readwrite", startIn: "documents" })
  } catch {
    return { ok: false } // the writer closed the picker
  }
  // IndexedDB can store directory handles, so the choice survives reloads.
  await setMeta(META_KEYS.folderHandle, handle)
  await deleteMeta(META_KEYS.folderLastError)
  return writeFolderBackup()
}

/** Asks the browser to allow writing to the chosen folder again. Must run from a click. */
export async function reconnectBackupFolder(): Promise<boolean> {
  const handle = await storedHandle()
  if (!handle) return false
  try {
    return (await handle.requestPermission({ mode: "readwrite" })) === "granted"
  } catch {
    return false
  }
}

export async function forgetBackupFolder(): Promise<void> {
  await Promise.all([
    deleteMeta(META_KEYS.folderHandle),
    deleteMeta(META_KEYS.folderLastWriteAt),
    deleteMeta(META_KEYS.folderLastError),
  ])
}

const DAILY_FILE = new RegExp(
  `^${slugify(APP_NAME)}-backup-(\\d{4}-\\d{2}-\\d{2})\\.${BACKUP_FILE_EXTENSION}$`
)

/** Deletes our daily backup files beyond the newest KEEP_DAYS. Leaves every other file alone. */
async function pruneOldBackups(handle: PermissionHandle): Promise<void> {
  const ours: string[] = []
  for await (const name of handle.keys()) {
    if (DAILY_FILE.test(name)) ours.push(name)
  }
  ours.sort().reverse()
  for (const name of ours.slice(KEEP_DAYS)) {
    await handle.removeEntry(name).catch(() => {})
  }
}

/**
 * Writes today's backup into the chosen folder, if one is chosen and the
 * browser still allows writing. Never asks for anything, so it is safe to
 * call in the background.
 */
export async function writeFolderBackup(): Promise<{ ok: true } | { ok: false; error?: string }> {
  const handle = await storedHandle()
  if (!handle) return { ok: false }
  try {
    if ((await handle.queryPermission({ mode: "readwrite" })) !== "granted") return { ok: false }
    const blob = await createBackup("full")
    const fileHandle = await handle.getFileHandle(fullBackupFileName(), { create: true })
    const writable = await fileHandle.createWritable()
    await writable.write(blob)
    await writable.close()
    await pruneOldBackups(handle)
    await setMeta(META_KEYS.folderLastWriteAt, new Date().toISOString())
    await deleteMeta(META_KEYS.folderLastError)
    await recordBackup("folder")
    return { ok: true }
  } catch (err) {
    const error =
      err instanceof DOMException && err.name === "NotFoundError"
        ? "The backup folder was moved or deleted. Choose it again."
        : "Couldn't write to the backup folder."
    await setMeta(META_KEYS.folderLastError, `${error} (${localDate()})`)
    return { ok: false, error }
  }
}
