"use client"

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from "./alert-dialog"
import { Button } from "./button"

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  itemName,
  itemLabel = "item",
  description,
  onConfirm,
  pending,
  title,
  confirmLabel,
  pendingLabel,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The specific thing being deleted, e.g. a character's name — quoted in the description. */
  itemName: string
  /** What kind of thing it is, e.g. "character" — used in the title as "Delete character?". */
  itemLabel?: string
  /** Override the default "This will permanently delete…" body text entirely. */
  description?: React.ReactNode
  onConfirm: () => void
  pending?: boolean
  /** Defaults to "Delete {itemLabel}?". */
  title?: string
  /** Defaults to "Delete". */
  confirmLabel?: string
  /** Defaults to "Deleting…". */
  pendingLabel?: string
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title ?? `Delete ${itemLabel}?`}</AlertDialogTitle>
          <AlertDialogDescription>
            {description ?? (
              <>
                This will permanently delete &ldquo;{itemName}&rdquo;. This can&apos;t be undone.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirm} disabled={pending}>
            {pending ? (pendingLabel ?? "Deleting…") : (confirmLabel ?? "Delete")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
