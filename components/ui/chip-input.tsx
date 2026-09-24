"use client"

import { useState } from "react"
import { XIcon } from "@phosphor-icons/react/dist/ssr"
import { Badge } from "@/components/ui/badge"
import { cn } from "cn"

/**
 * A small inline tag editor — existing tags render as removable chips, and
 * a bare text input (no label, no dialog) lets you add more. Replaces the
 * old labeled "comma-separated" text field (Part 7.1).
 *
 * Read-only when `editing` is false: chips render without the remove
 * button and no input is shown, so the card looks like a normal tag list
 * until the person actually clicks in to edit it.
 */
export function ChipInput({
  tags,
  onChange,
  editing,
  className,
}: {
  tags: string[]
  onChange: (tags: string[]) => void
  editing: boolean
  className?: string
}) {
  const [draft, setDraft] = useState("")

  function commitDraft() {
    const value = draft.trim()
    if (value && !tags.includes(value)) onChange([...tags, value])
    setDraft("")
  }

  function removeTag(tag: string) {
    onChange(tags.filter((t) => t !== tag))
  }

  if (!editing && tags.length === 0) return null

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {tags.map((tag) => (
        <Badge key={tag} variant="secondary" className={editing ? "gap-1 py-0.5 pr-1" : undefined}>
          {tag}
          {editing ? (
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="rounded-full text-muted-foreground hover:text-foreground"
              aria-label={`Remove tag ${tag}`}
            >
              <XIcon className="size-2.5" />
            </button>
          ) : null}
        </Badge>
      ))}
      {editing ? (
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault()
              commitDraft()
            } else if (e.key === "Backspace" && draft === "" && tags.length > 0) {
              removeTag(tags[tags.length - 1])
            }
          }}
          onBlur={commitDraft}
          placeholder={tags.length === 0 ? "Add a tag…" : ""}
          className="h-5 min-w-16 flex-1 bg-transparent text-xs text-muted-foreground outline-none placeholder:text-muted-foreground"
        />
      ) : null}
    </div>
  )
}
