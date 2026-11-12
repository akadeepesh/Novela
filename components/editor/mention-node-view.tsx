"use client"

import { useState } from "react"
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react"
import { cn } from "cn"
import type { MentionableType } from "@/lib/store/mentions"

const TYPE_STYLE: Record<MentionableType, string> = {
  character: "bg-primary/10 text-primary",
  world: "bg-accent text-accent-foreground",
  plot: "bg-secondary text-secondary-foreground",
}

export function MentionNodeView({ node }: NodeViewProps) {
  const [open, setOpen] = useState(false)
  const label = node.attrs.label as string
  const entityType = (node.attrs.entityType as MentionableType) ?? "character"
  const preview = node.attrs.preview as string | undefined

  return (
    <NodeViewWrapper as="span" className="relative inline-block">
      <span
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className={cn(
          "cursor-default rounded px-1 py-0.5 text-[0.95em] font-medium",
          TYPE_STYLE[entityType]
        )}
      >
        @{label}
      </span>

      {open && preview ? (
        <span
          contentEditable={false}
          className="pointer-events-none absolute bottom-full left-0 z-50 mb-1.5 block w-56 rounded-md border border-border bg-popover px-2.5 py-2 text-xs leading-snug text-popover-foreground shadow-md"
        >
          {preview}
        </span>
      ) : null}
    </NodeViewWrapper>
  )
}
