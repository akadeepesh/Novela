import { APP_NAME, BACKUP_FILE_EXTENSION } from "@/lib/brand"
import { createBackup } from "./format"
import { recordBackup } from "./status"
import { db } from "@/lib/store/db"

export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "book"
  )
}

/** Today's date as YYYY-MM-DD, in the writer's own timezone. */
export function localDate(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function fullBackupFileName(date = new Date()): string {
  return `${slugify(APP_NAME)}-backup-${localDate(date)}.${BACKUP_FILE_EXTENSION}`
}

export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** Downloads every book (Trash and history included) as one file, and records the backup. */
export async function downloadFullBackup(): Promise<void> {
  const blob = await createBackup("full")
  saveBlob(blob, fullBackupFileName())
  await recordBackup("download")
}

/** Downloads one book and everything in it as a project file. */
export async function downloadProjectFile(projectId: string): Promise<boolean> {
  const project = await db().projects.get(projectId)
  if (!project) return false
  const blob = await createBackup("project", [projectId])
  saveBlob(blob, `${slugify(project.title)}.${BACKUP_FILE_EXTENSION}`)
  return true
}
