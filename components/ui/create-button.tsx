"use client"

import { useRef, useState, useTransition } from "react"
import { PlusIcon } from "@phosphor-icons/react/dist/ssr"
import { Button } from "@/components/ui/button"

/**
 * "New …" button for actions that create a record and redirect into it.
 * Ignores clicks while a create is already running, so a double-click can't
 * make two records. (A plain <form action> has no such guard.)
 */
export function CreateButton({
  action,
  children,
  disabled,
}: {
  action: () => Promise<void>
  children: React.ReactNode
  disabled?: boolean
}) {
  const [isPending, startTransition] = useTransition()
  const [failed, setFailed] = useState(false)
  const locked = useRef(false)

  function handleClick() {
    if (locked.current) return
    locked.current = true
    setFailed(false)
    startTransition(async () => {
      try {
        await action()
        // A successful create always redirects into the new item, so getting
        // here means the server could not create it (see safeAction).
        setFailed(true)
      } finally {
        locked.current = false
      }
    })
  }

  return (
    <div className="flex items-center gap-2">
      {failed ? (
        <span role="alert" className="text-xs text-destructive">
          Couldn&apos;t create it. Try again.
        </span>
      ) : null}
      <Button type="button" size="sm" disabled={isPending || disabled} onClick={handleClick}>
        <PlusIcon />
        {children}
      </Button>
    </div>
  )
}
