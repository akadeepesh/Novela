"use client"

import { useRef, useState, useTransition } from "react"
import Link from "next/link"
import { UploadSimpleIcon } from "@phosphor-icons/react/dist/ssr"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog"
import { BACKUP_FILE_EXTENSION } from "@/lib/brand"
import {
  BackupError,
  findConflicts,
  importBackup,
  readBackup,
  type ConflictChoice,
  type ImportResult,
  type ParsedBackup,
} from "@/lib/backup/format"

type Pending = { backup: ParsedBackup; conflicts: { id: string; title: string }[] }

/**
 * Opens a project file or full backup and brings it into this browser.
 * Books that already exist here prompt a choice: replace them, or keep both.
 */
export function ImportButton({
  label = "Import a file",
  variant = "outline",
  size = "sm",
}: {
  label?: string
  variant?: "outline" | "ghost" | "default"
  size?: "sm" | "default" | "lg"
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isPending, startTransition] = useTransition()
  const [pending, setPending] = useState<Pending | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)

  function finish(backup: ParsedBackup, choice: ConflictChoice) {
    startTransition(async () => {
      try {
        setResult(await importBackup(backup, choice))
      } catch (err) {
        console.error("import failed", err)
        setError("Couldn't import this file. Nothing was changed.")
      }
      setPending(null)
    })
  }

  function onFile(file: File | undefined) {
    if (!file) return
    setError(null)
    setResult(null)
    startTransition(async () => {
      try {
        const backup = await readBackup(file)
        const conflicts = await findConflicts(backup)
        if (conflicts.length > 0) setPending({ backup, conflicts })
        else finish(backup, "replace")
      } catch (err) {
        setError(err instanceof BackupError ? err.message : "Couldn't read this file.")
      }
    })
  }

  const conflictNames = pending?.conflicts.map((c) => `“${c.title}”`).join(", ")
  const one = pending?.conflicts.length === 1

  return (
    <div className="flex flex-col items-start gap-2">
      <input
        ref={inputRef}
        type="file"
        accept={`.${BACKUP_FILE_EXTENSION},.zip,application/zip`}
        className="hidden"
        onChange={(e) => {
          onFile(e.target.files?.[0])
          e.target.value = ""
        }}
      />
      <Button type="button" variant={variant} size={size} disabled={isPending} onClick={() => inputRef.current?.click()}>
        <UploadSimpleIcon />
        {isPending ? "Importing…" : label}
      </Button>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {result ? (
        <p role="status" className="text-sm text-foreground">
          {result.imported.length === 1 ? (
            <>
              Imported{" "}
              <Link href={`/projects/${result.imported[0].id}/overview`} className="font-medium underline underline-offset-2">
                {result.imported[0].title}
              </Link>
              .
            </>
          ) : (
            <>Imported {result.imported.length} books.</>
          )}
        </p>
      ) : null}

      <AlertDialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{one ? "This book is already here" : "Some books are already here"}</AlertDialogTitle>
            <AlertDialogDescription>
              {conflictNames} {one ? "already exists" : "already exist"} in this browser. Replace{" "}
              {one ? "it" : "them"} with the version in the file, or keep both? Replacing deletes the
              current {one ? "version" : "versions"}, including any changes made since the file was saved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button type="button" variant="outline" disabled={isPending} onClick={() => setPending(null)}>
              Cancel
            </Button>
            <Button type="button" variant="outline" disabled={isPending} onClick={() => pending && finish(pending.backup, "copy")}>
              Keep both
            </Button>
            <Button type="button" variant="destructive" disabled={isPending} onClick={() => pending && finish(pending.backup, "replace")}>
              Replace
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
