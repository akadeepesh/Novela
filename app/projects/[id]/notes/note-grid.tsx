"use client"

import { useState } from "react"
import type { SerializedNoteSummary } from "@/lib/store/notes"
import { NoteComposer } from "./note-composer"
import { NoteCard } from "./note-card"

function sortNotes(notes: SerializedNoteSummary[]): SerializedNoteSummary[] {
  return [...notes].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  })
}

export function NoteGrid({
  projectId,
  notes: initialNotes,
}: {
  projectId: string
  notes: SerializedNoteSummary[]
}) {
  const [notes, setNotes] = useState(initialNotes)
  // Follow the stored list as it changes (it updates live, also from other tabs).
  const [prev, setPrev] = useState(initialNotes)
  if (initialNotes !== prev) {
    setPrev(initialNotes)
    setNotes(initialNotes)
  }

  function handleCreated(note: SerializedNoteSummary) {
    setNotes((prev) => sortNotes([note, ...prev]))
  }

  function handleSaved(next: SerializedNoteSummary) {
    setNotes((prev) => sortNotes(prev.map((n) => (n.id === next.id ? next : n))))
  }

  function handleDeleted(id: string) {
    setNotes((prev) => prev.filter((n) => n.id !== id))
  }

  return (
    <div className="flex flex-col gap-6">
      <NoteComposer projectId={projectId} onCreated={handleCreated} />

      {notes.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Nothing here yet — start typing above.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {notes.map((note) => (
            <NoteCard
              key={note.id}
              projectId={projectId}
              note={note}
              onSaved={handleSaved}
              onDeleted={handleDeleted}
            />
          ))}
        </div>
      )}
    </div>
  )
}
