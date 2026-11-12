"use client"

import { useState } from "react"
import type { SerializedResearchEntrySummary } from "@/lib/store/notes"
import { ResearchComposer } from "./research-composer"
import { ResearchEntryCard } from "./research-entry-card"

export function ResearchEntryGrid({
  projectId,
  entries: initialEntries,
}: {
  projectId: string
  entries: SerializedResearchEntrySummary[]
}) {
  const [entries, setEntries] = useState(initialEntries)
  // Follow the stored list as it changes (it updates live, also from other tabs).
  const [prev, setPrev] = useState(initialEntries)
  if (initialEntries !== prev) {
    setPrev(initialEntries)
    setEntries(initialEntries)
  }

  function handleCreated(entry: SerializedResearchEntrySummary) {
    setEntries((prev) => [entry, ...prev])
  }

  function handleSaved(next: SerializedResearchEntrySummary) {
    setEntries((prev) => prev.map((e) => (e.id === next.id ? next : e)))
  }

  function handleDeleted(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }

  return (
    <div className="flex flex-col gap-6">
      <ResearchComposer projectId={projectId} onCreated={handleCreated} />

      {entries.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Paste a link above to start your source board.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map((entry) => (
            <ResearchEntryCard
              key={entry.id}
              projectId={projectId}
              entry={entry}
              onSaved={handleSaved}
              onDeleted={handleDeleted}
            />
          ))}
        </div>
      )}
    </div>
  )
}
