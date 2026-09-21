"use client"

import { useEffect, useState } from "react"
import { XIcon, ClockCounterClockwiseIcon, FloppyDiskIcon } from "@phosphor-icons/react/dist/ssr"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { SerializedVersion } from "@/lib/versions"
import type { DiffPart } from "@/lib/text-diff"
import { createVersionAction, listVersionsAction, getVersionDiffAction, restoreVersionAction } from "./actions"

const KIND_LABEL: Record<SerializedVersion["kind"], string> = {
  auto: "Autosaved",
  manual: "Saved version",
  "restore-point": "Before restore",
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export function VersionHistoryPanel({
  projectId,
  chapterId,
  getCurrentContent,
  onClose,
}: {
  projectId: string
  chapterId: string
  getCurrentContent: () => unknown
  onClose: () => void
}) {
  const [versions, setVersions] = useState<SerializedVersion[] | null>(null)
  const [label, setLabel] = useState("")
  const [saving, setSaving] = useState(false)
  const [openDiffId, setOpenDiffId] = useState<string | null>(null)
  const [diff, setDiff] = useState<DiffPart[] | null>(null)
  const [diffLoading, setDiffLoading] = useState(false)
  const [restoringId, setRestoringId] = useState<string | null>(null)

  async function refresh() {
    const list = await listVersionsAction(projectId, chapterId)
    setVersions(list)
  }

  useEffect(() => {
    // Standard fetch-on-mount: syncing local state with the server, which
    // is exactly what useEffect is for. The set-state-in-effect rule is
    // tuned for the "adjusting state to match a prop change" anti-pattern,
    // not this one — safe to disable here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSaveVersion() {
    setSaving(true)
    await createVersionAction(projectId, chapterId, label)
    setLabel("")
    setSaving(false)
    await refresh()
  }

  async function handleToggleDiff(versionId: string) {
    if (openDiffId === versionId) {
      setOpenDiffId(null)
      setDiff(null)
      return
    }
    setOpenDiffId(versionId)
    setDiff(null)
    setDiffLoading(true)
    const result = await getVersionDiffAction(projectId, chapterId, versionId, getCurrentContent())
    setDiff(result.diff)
    setDiffLoading(false)
  }

  async function handleRestore(versionId: string, title: string) {
    if (!window.confirm(`Restore "${title}"? Your current draft will be saved first, so nothing is lost.`))
      return
    setRestoringId(versionId)
    const result = await restoreVersionAction(projectId, chapterId, versionId)
    if (result.ok) {
      window.location.reload()
    } else {
      setRestoringId(null)
    }
  }

  return (
    <div className="flex h-full w-80 shrink-0 flex-col border-l border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          <ClockCounterClockwiseIcon className="size-4" />
          Version history
        </p>
        <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <XIcon className="size-4" />
        </button>
      </div>

      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Label (optional)"
          className="h-8 text-xs"
        />
        <Button type="button" size="icon-sm" onClick={handleSaveVersion} disabled={saving} aria-label="Save version">
          <FloppyDiskIcon />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {versions === null ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : versions.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No versions yet — one is saved automatically every 15 minutes while you write, or click the
            save icon above anytime.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {versions.map((v) => (
              <li key={v.id} className="rounded-md border border-border p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground">
                      {v.label || KIND_LABEL[v.kind]}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatTime(v.createdAt)} · {v.wordCount.toLocaleString()} words
                    </p>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleToggleDiff(v.id)}
                    className="text-[11px] font-medium text-primary hover:underline"
                  >
                    {openDiffId === v.id ? "Hide changes" : "View changes"}
                  </button>
                  <button
                    type="button"
                    disabled={restoringId === v.id}
                    onClick={() => handleRestore(v.id, v.label || KIND_LABEL[v.kind])}
                    className="text-[11px] font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
                  >
                    {restoringId === v.id ? "Restoring…" : "Restore"}
                  </button>
                </div>
                {openDiffId === v.id ? (
                  <div className="mt-2 max-h-48 overflow-y-auto rounded bg-muted/50 p-2 text-[11px] leading-relaxed">
                    {diffLoading ? (
                      <span className="text-muted-foreground">Comparing…</span>
                    ) : (
                      diff?.map((part, i) => (
                        <span
                          key={i}
                          className={cn(
                            part.type === "insert" && "bg-accent text-accent-foreground",
                            part.type === "delete" && "text-destructive line-through opacity-70"
                          )}
                        >
                          {part.text}
                        </span>
                      ))
                    )}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
