"use client"

import { useRef, useTransition } from "react"
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
  const locked = useRef(false)

  function handleClick() {
    if (locked.current) return
    locked.current = true
    startTransition(async () => {
      try {
        await action()
      } finally {
        locked.current = false
      }
    })
  }

  return (
    <Button type="button" size="sm" disabled={isPending || disabled} onClick={handleClick}>
      <PlusIcon />
      {children}
    </Button>
  )
}
