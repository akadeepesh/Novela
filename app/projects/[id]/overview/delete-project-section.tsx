"use client"

import { useState, useTransition } from "react"
import { TrashIcon } from "@phosphor-icons/react/dist/ssr"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog"
import { deleteProjectAction } from "./actions"

export function DeleteProjectSection({
  projectId,
  projectTitle,
}: {
  projectId: string
  projectTitle: string
}) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleConfirm() {
    setError(null)
    startTransition(async () => {
      const result = await deleteProjectAction(projectId)
      // A successful delete redirects server-side and never returns here —
      // reaching this line means it failed.
      if (result?.error) {
        setError(result.error)
        setOpen(false)
      }
    })
  }

  return (
    <Card className="border-destructive/30">
      <CardHeader>
        <CardTitle className="text-base text-destructive">Danger zone</CardTitle>
        <CardDescription>Permanently delete this project and everything in it.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div>
          <Button type="button" variant="destructive" size="sm" onClick={() => setOpen(true)}>
            <TrashIcon />
            Delete project
          </Button>
        </div>
      </CardContent>

      <DeleteConfirmDialog
        open={open}
        onOpenChange={setOpen}
        itemName={projectTitle}
        itemLabel="project"
        description={
          <>
            This will permanently delete &ldquo;{projectTitle}&rdquo; and everything in it —
            every chapter, character, world entry, plot thread, note, research entry, and
            version history. This can&apos;t be undone.
          </>
        }
        onConfirm={handleConfirm}
        pending={isPending}
      />
    </Card>
  )
}
