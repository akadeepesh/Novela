"use client"

import { useState, useTransition } from "react"
import { FileArrowDownIcon } from "@phosphor-icons/react/dist/ssr"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BACKUP_FILE_EXTENSION } from "@/lib/brand"
import { downloadProjectFile } from "@/lib/backup/download"

/** Saves this book as a project file: everything in it, to move or keep as a backup. */
export function ProjectFileCard({ projectId }: { projectId: string }) {
  const [busy, startBusy] = useTransition()
  const [failed, setFailed] = useState(false)

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="text-base">Project file</CardTitle>
        <CardDescription>
          The whole book in one .{BACKUP_FILE_EXTENSION} file: chapters, history, story bible, notes,
          research and images. Open it in another browser or computer from Settings, or keep it as a
          backup.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          disabled={busy}
          onClick={() =>
            startBusy(async () => {
              setFailed(false)
              await downloadProjectFile(projectId).catch(() => setFailed(true))
            })
          }
        >
          <FileArrowDownIcon />
          {busy ? "Preparing…" : "Download project file"}
        </Button>
        {failed ? <p className="text-sm text-destructive">Couldn&apos;t make the file. Please try again.</p> : null}
      </CardContent>
    </Card>
  )
}
