"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  MagnifyingGlassIcon,
  BookOpenIcon,
  NotePencilIcon,
  ArrowRightIcon,
} from "@phosphor-icons/react/dist/ssr"
import { cn } from "cn"
import { SECTION_DEFS, sectionLabel, sectionLabelSingular, type ProjectType, type SectionId } from "@/lib/project-config"
import type { SearchItem, SearchItemKind } from "@/lib/search"

const KIND_ICON: Record<SearchItemKind, typeof BookOpenIcon> = {
  chapter: BookOpenIcon,
  note: NotePencilIcon,
  research: MagnifyingGlassIcon,
}

const KIND_HREF: Record<SearchItemKind, string> = {
  chapter: "chapters",
  note: "notes",
  research: "research",
}

type NavEntry = { type: "nav"; href: string; label: string; icon: typeof BookOpenIcon }
type ResultEntry = { type: "result"; href: string; item: SearchItem }
type Entry = NavEntry | ResultEntry

export function CommandPalette({
  projectId,
  projectType,
  sections,
  items,
  hideTrigger,
}: {
  projectId: string
  projectType: ProjectType
  sections: SectionId[]
  items: SearchItem[]
  hideTrigger?: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const navEntries: NavEntry[] = useMemo(
    () =>
      sections.map((id) => ({
        type: "nav",
        href: `/projects/${projectId}/${id}`,
        label: sectionLabel(id, projectType),
        icon: SECTION_DEFS[id].icon,
      })),
    [sections, projectId, projectType]
  )

  const entries: Entry[] = useMemo(() => {
    const q = query.trim().toLowerCase()

    if (!q) {
      return navEntries
    }

    const filteredNav = navEntries.filter((n) => n.label.toLowerCase().includes(q))
    const filteredResults: ResultEntry[] = items
      .filter((item) => item.searchText.includes(q))
      .slice(0, 20)
      .map((item) => ({
        type: "result",
        href: `/projects/${projectId}/${KIND_HREF[item.kind]}/${item.id}`,
        item,
      }))

    return [...filteredNav, ...filteredResults]
  }, [query, navEntries, items, projectId])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setOpen((v) => !v)
      } else if (e.key === "Escape") {
        setOpen(false)
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [])

  useEffect(() => {
    if (open) {
      // Wait a tick for the input to mount before focusing.
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  // Reset the selection whenever the visible entries change, and clear the
  // query whenever the palette opens — both are "adjust state during
  // render" cases, not side effects, so they're handled inline rather than
  // via useEffect (which would cause an extra render pass).
  const [lastQuery, setLastQuery] = useState(query)
  if (query !== lastQuery) {
    setLastQuery(query)
    setSelectedIndex(0)
  }

  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setQuery("")
  }

  function go(entry: Entry) {
    router.push(entry.href)
    setOpen(false)
  }

  function handleInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setSelectedIndex((i) => Math.min(i + 1, entries.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setSelectedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === "Enter") {
      e.preventDefault()
      const entry = entries[selectedIndex]
      if (entry) go(entry)
    }
  }

  return (
    <>
      {!hideTrigger ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mx-4 mb-1 flex items-center gap-2 rounded-md border border-sidebar-border bg-sidebar-accent/40 px-2.5 py-1.5 text-left text-xs text-sidebar-foreground/60 transition-colors hover:text-sidebar-foreground"
        >
          <MagnifyingGlassIcon className="size-3.5 shrink-0" />
          <span className="flex-1">Search…</span>
          <kbd className="rounded border border-sidebar-border px-1 font-sans text-[10px]">⌘K</kbd>
        </button>
      ) : null}

      {open ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-foreground/20 pt-[15vh]" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-lg overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-border px-3.5 py-3">
              <MagnifyingGlassIcon className="size-4 shrink-0 text-muted-foreground" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleInputKeyDown}
                placeholder="Jump to a section, chapter, note, or research entry…"
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>

            <div className="max-h-80 overflow-y-auto p-1.5">
              {entries.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">No matches</p>
              ) : (
                entries.map((entry, index) => {
                  const isSelected = index === selectedIndex
                  const Icon = entry.type === "nav" ? entry.icon : KIND_ICON[entry.item.kind]
                  const label = entry.type === "nav" ? entry.label : entry.item.title
                  const meta =
                    entry.type === "nav"
                      ? "Go to"
                      : entry.item.kind === "chapter"
                        ? sectionLabelSingular("chapters", projectType)
                        : entry.item.kind === "note"
                          ? "Note"
                          : "Research"

                  return (
                    <button
                      key={`${entry.type}-${entry.type === "nav" ? entry.href : entry.item.id}`}
                      type="button"
                      onClick={() => go(entry)}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={cn(
                        "flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left text-sm",
                        isSelected ? "bg-muted text-foreground" : "text-popover-foreground"
                      )}
                    >
                      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate font-medium">{label}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">{meta}</span>
                        </span>
                        {entry.type === "result" && entry.item.snippet ? (
                          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                            {entry.item.snippet}
                          </span>
                        ) : null}
                      </span>
                      {isSelected ? (
                        <ArrowRightIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                      ) : null}
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
