"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { TrashIcon } from "@phosphor-icons/react/dist/ssr"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog"
import { trashProjectAction } from "@/app/dashboard/trash/actions"
import { TRASH_DAYS } from "@/lib/trash-config"

export function DeleteProjectSection({
  projectId,
  projectTitle,
}: {
  projectId: string
  projectTitle: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleConfirm() {
    setError(null)
    startTransition(async () => {
      const result = await trashProjectAction(projectId)
      if (result?.ok) {
        router.push("/dashboard")
        return
      }
      setError(result?.error ?? "Couldn't move this project to the Trash. Try again.")
      setOpen(false)
    })
  }

  return (
    <Card className="border-destructive/30">
      <CardHeader>
        <CardTitle className="text-base text-destructive">Move to trash</CardTitle>
        <CardDescription>
          Take this project off your dashboard. It stays in the Trash for {TRASH_DAYS} days and
          you can restore it any time before then.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div>
          <Button type="button" variant="destructive" size="sm" onClick={() => setOpen(true)}>
            <TrashIcon />
            Move to trash
          </Button>
        </div>
      </CardContent>

      <DeleteConfirmDialog
        open={open}
        onOpenChange={setOpen}
        itemName={projectTitle}
        itemLabel="project"
        title="Move to trash?"
        confirmLabel="Move to trash"
        pendingLabel="Moving…"
        description={
          <>
            &ldquo;{projectTitle}&rdquo; and everything in it will move to the Trash. You can restore
            it for {TRASH_DAYS} days; after that it is deleted for good.
          </>
        }
        onConfirm={handleConfirm}
        pending={isPending}
      />
    </Card>
  )
}
