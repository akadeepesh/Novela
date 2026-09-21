"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { PlusIcon } from "@phosphor-icons/react/dist/ssr"
import {
  ADDABLE_SECTIONS,
  SECTION_DEFS,
  sectionLabel,
  type ProjectType,
  type SectionId,
} from "@/lib/project-config"
import { addProjectSectionAction } from "@/app/actions/project-sections"

const rowClass =
  "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sm text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground disabled:opacity-50"

/** Sidebar footer: lists whichever optional sections this project doesn't have yet. */
export function AddSectionControl({
  projectId,
  projectType,
  sections,
}: {
  projectId: string
  projectType: ProjectType
  sections: SectionId[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const missing = ADDABLE_SECTIONS.filter((id) => !sections.includes(id))
  if (missing.length === 0) return null

  function add(sectionId: SectionId) {
    startTransition(async () => {
      await addProjectSectionAction(projectId, sectionId)
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <div className="border-t border-sidebar-border px-2.5 py-2">
      {open ? (
        <div className="flex flex-col gap-0.5">
          {missing.map((id) => {
            const { icon: IconComponent } = SECTION_DEFS[id]
            return (
              <button key={id} type="button" disabled={isPending} onClick={() => add(id)} className={rowClass}>
                <IconComponent className="size-4 shrink-0" />
                {sectionLabel(id, projectType)}
              </button>
            )
          })}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="px-2.5 py-1 text-left text-xs text-sidebar-foreground/50 hover:text-sidebar-foreground"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className={rowClass + " w-full text-sidebar-foreground/50"}>
          <PlusIcon className="size-4 shrink-0" />
          Add section
        </button>
      )}
    </div>
  )
}
