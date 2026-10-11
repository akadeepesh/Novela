"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { cn } from "cn"
import { DotsThreeIcon, GearSixIcon, TrashIcon } from "@phosphor-icons/react/dist/ssr"
import { Menu, MenuTrigger, MenuContent, MenuItem } from "@/components/ui/menu"
import { trashProjectAction } from "@/app/dashboard/trash/actions"

/** "⋯" menu on a dashboard project. Moving to the Trash is undoable, so no confirmation. */
export function ProjectMenu({ projectId, className }: { projectId: string; className?: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function moveToTrash() {
    startTransition(async () => {
      await trashProjectAction(projectId)
      router.refresh()
    })
  }

  // The wrapper stops clicks from reaching a clickable parent (the hero card),
  // including clicks inside the menu popup, which React bubbles through the portal.
  return (
    <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <Menu>
        <MenuTrigger
          disabled={pending}
          aria-label="Project actions"
          className={cn(
            "rounded-md p-1.5 text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50",
            className
          )}
        >
          <DotsThreeIcon className="size-4" weight="bold" />
        </MenuTrigger>
        <MenuContent>
          <MenuItem render={<Link href={`/projects/${projectId}/overview`} />}>
            <GearSixIcon className="size-4" />
            Book settings
          </MenuItem>
          <MenuItem onClick={moveToTrash}>
            <TrashIcon className="size-4" />
            Move to trash
          </MenuItem>
        </MenuContent>
      </Menu>
    </span>
  )
}
