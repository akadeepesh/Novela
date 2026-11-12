"use client"

import { forwardRef, useEffect, useImperativeHandle, useState } from "react"
import { UserCircleIcon, MapPinIcon, PuzzlePieceIcon } from "@phosphor-icons/react/dist/ssr"
import { cn } from "cn"
import type { Mentionable, MentionableType } from "@/lib/store/mentions"

const TYPE_ICON: Record<MentionableType, typeof UserCircleIcon> = {
  character: UserCircleIcon,
  world: MapPinIcon,
  plot: PuzzlePieceIcon,
}

const TYPE_LABEL: Record<MentionableType, string> = {
  character: "Character",
  world: "World",
  plot: "Plot",
}

export type MentionListRef = {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean
}

type MentionListProps = {
  items: Mentionable[]
  command: (item: Mentionable) => void
}

export const MentionList = forwardRef<MentionListRef, MentionListProps>(function MentionList(
  { items, command },
  ref
) {
  const [selectedIndex, setSelectedIndex] = useState(0)

  useEffect(() => setSelectedIndex(0), [items])

  function selectItem(index: number) {
    const item = items[index]
    if (item) command(item)
  }

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (items.length === 0) return false
      if (event.key === "ArrowUp") {
        setSelectedIndex((i) => (i + items.length - 1) % items.length)
        return true
      }
      if (event.key === "ArrowDown") {
        setSelectedIndex((i) => (i + 1) % items.length)
        return true
      }
      if (event.key === "Enter") {
        selectItem(selectedIndex)
        return true
      }
      return false
    },
  }))

  if (items.length === 0) {
    return (
      <div className="w-64 rounded-md border border-border bg-popover p-2.5 text-sm text-muted-foreground shadow-md">
        No matches
      </div>
    )
  }

  return (
    <div className="flex w-64 flex-col gap-0.5 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md">
      {items.map((item, index) => {
        const Icon = TYPE_ICON[item.type]
        return (
          <button
            key={`${item.type}-${item.id}`}
            type="button"
            onClick={() => selectItem(index)}
            onMouseEnter={() => setSelectedIndex(index)}
            className={cn(
              "flex items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors",
              index === selectedIndex ? "bg-muted text-foreground" : "text-popover-foreground"
            )}
          >
            <Icon className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            <span className="shrink-0 text-xs text-muted-foreground">{TYPE_LABEL[item.type]}</span>
          </button>
        )
      })}
    </div>
  )
})
