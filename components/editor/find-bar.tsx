"use client"

import { useEffect, useRef, useState } from "react"
import type { Editor } from "@tiptap/react"
import { CaretDownIcon, CaretUpIcon, XIcon } from "@phosphor-icons/react/dist/ssr"
import { cn } from "cn"
import { getFindReplaceState } from "./find-replace-extension"

/**
 * The find & replace bar above the page (Ctrl/Cmd+F). Enter goes to the
 * next match, Shift+Enter to the previous one, Escape closes.
 */
export function FindBar({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const [query, setQuery] = useState("")
  const [replacement, setReplacement] = useState("")
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [wholeWord, setWholeWord] = useState(false)
  const [, rerender] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Re-read the match count whenever the document or selection changes.
  useEffect(() => {
    const update = () => rerender((n) => n + 1)
    editor.on("transaction", update)
    return () => {
      editor.off("transaction", update)
    }
  }, [editor])

  useEffect(() => {
    editor.commands.setSearch(query, { caseSensitive, wholeWord })
  }, [editor, query, caseSensitive, wholeWord])

  // Clear the highlights when the bar closes.
  useEffect(() => {
    inputRef.current?.focus()
    return () => {
      if (!editor.isDestroyed) editor.commands.clearSearch()
    }
  }, [editor])

  const state = getFindReplaceState(editor.state)
  const total = state?.matches.length ?? 0
  const position = total > 0 ? (state?.current ?? 0) + 1 : 0

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault()
      onClose()
      editor.commands.focus()
    } else if (e.key === "Enter" && e.currentTarget === inputRef.current) {
      e.preventDefault()
      editor.commands.gotoMatch(e.shiftKey ? -1 : 1)
    }
  }

  return (
    <div
      role="search"
      className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/40 px-4 py-2 text-sm"
      onKeyDown={onKeyDown}
    >
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Find"
        aria-label="Find"
        className="h-8 w-44 rounded-md border border-input bg-background px-2 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      />
      <span className="w-16 text-xs text-muted-foreground tabular-nums" aria-live="polite">
        {query ? `${position} of ${total}` : ""}
      </span>
      <IconToggle label="Previous match" onClick={() => editor.commands.gotoMatch(-1)} disabled={total === 0}>
        <CaretUpIcon />
      </IconToggle>
      <IconToggle label="Next match" onClick={() => editor.commands.gotoMatch(1)} disabled={total === 0}>
        <CaretDownIcon />
      </IconToggle>
      <IconToggle label="Match case" active={caseSensitive} onClick={() => setCaseSensitive((v) => !v)}>
        <span className="text-xs font-semibold">Aa</span>
      </IconToggle>
      <IconToggle label="Whole words" active={wholeWord} onClick={() => setWholeWord((v) => !v)}>
        <span className="text-xs font-semibold underline">ab</span>
      </IconToggle>

      <input
        value={replacement}
        onChange={(e) => setReplacement(e.target.value)}
        placeholder="Replace with"
        aria-label="Replace with"
        className="ml-2 h-8 w-44 rounded-md border border-input bg-background px-2 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      />
      <button
        type="button"
        onClick={() => editor.commands.replaceCurrent(replacement)}
        disabled={total === 0}
        className="rounded-md px-2 py-1 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-40"
      >
        Replace
      </button>
      <button
        type="button"
        onClick={() => editor.commands.replaceAll(replacement)}
        disabled={total === 0}
        className="rounded-md px-2 py-1 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-40"
      >
        Replace all
      </button>

      <IconToggle label="Close find" onClick={onClose} className="ml-auto">
        <XIcon />
      </IconToggle>
    </div>
  )
}

function IconToggle({
  label,
  active,
  disabled,
  onClick,
  className,
  children,
}: {
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  className?: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40 [&_svg]:size-4",
        active && "bg-primary/10 text-primary",
        className
      )}
    >
      {children}
    </button>
  )
}
