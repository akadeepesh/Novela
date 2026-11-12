"use client"

import { useEffect, useRef, useState } from "react"
import { XIcon, ClockCounterClockwiseIcon, FloppyDiskIcon } from "@phosphor-icons/react/dist/ssr"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog"
import type { SerializedVersion } from "@/lib/store/versions"
import type { DiffPart } from "@/lib/text-diff"
import type { ActionQueue } from "@/lib/action-queue"
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
  flushPending,
  enqueue,
  onClose,
}: {
  projectId: string
  chapterId: string
  getCurrentContent: () => unknown
  // Saves anything still waiting in the editor's debounce window; resolves to
  // false if that save failed. Versions are taken from the database, so this
  // must run first or they would miss the last few seconds of typing.
  flushPending: () => Promise<boolean>
  // The editor's queue. Version actions run through it so they can never
  // overtake a save that is still on its way.
  enqueue: ActionQueue
  onClose: () => void
}) {
  const [notice, setNotice] = useState<string | null>(null)
  const [versions, setVersions] = useState<SerializedVersion[] | null>(null)
  const [label, setLabel] = useState("")
  const [saving, setSaving] = useState(false)
  const [openDiffId, setOpenDiffId] = useState<string | null>(null)
  const [diff, setDiff] = useState<DiffPart[] | null>(null)
  const [diffLoading, setDiffLoading] = useState(false)
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const [restoreTarget, setRestoreTarget] = useState<{ id: string; title: string } | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  // The diff the person is waiting for. A slower, older response is dropped.
  const wantedDiff = useRef<string | null>(null)

  async function refresh() {
    const result = await listVersionsAction(projectId, chapterId)
    if (result.ok) {
      setVersions(result.versions)
      setLoadFailed(false)
    } else {
      setLoadFailed(true)
    }
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
    setNotice(null)
    if (!(await flushPending())) {
      setNotice("Couldn't save your latest changes, so no version was taken. Try again in a moment.")
      setSaving(false)
      return
    }
    const result = await enqueue(() => createVersionAction(projectId, chapterId, label))
    setSaving(false)
    if (!result.ok) {
      setNotice(result.error ?? "Couldn't save this version. Try again in a moment.")
      return
    }
    setLabel("")
    await refresh()
  }

  async function handleToggleDiff(versionId: string) {
    if (openDiffId === versionId) {
      wantedDiff.current = null
      setOpenDiffId(null)
      setDiff(null)
      return
    }
    wantedDiff.current = versionId
    setOpenDiffId(versionId)
    setDiff(null)
    setDiffLoading(true)
    const result = await getVersionDiffAction(projectId, chapterId, versionId, getCurrentContent())
    if (wantedDiff.current !== versionId) return
    setDiffLoading(false)
    if (result.ok) {
      setDiff(result.diff)
    } else {
      setOpenDiffId(null)
      setNotice("Couldn't compare with this version. It may have been removed.")
    }
  }

  function handleRestoreClick(versionId: string, title: string) {
    setRestoreTarget({ id: versionId, title })
  }

  async function handleConfirmRestore() {
    if (!restoreTarget) return
    const versionId = restoreTarget.id
    setRestoreTarget(null)
    setNotice(null)
    setRestoringId(versionId)
    // Save the current draft first so the "Before restore" snapshot really
    // contains it. If that fails, stop: restoring now would overwrite text
    // that exists nowhere else.
    if (!(await flushPending())) {
      setNotice("Couldn't save your current draft, so nothing was restored. Try again in a moment.")
      setRestoringId(null)
      return
    }
    const result = await enqueue(() => restoreVersionAction(projectId, chapterId, versionId))
    if (result.ok) {
      window.location.reload()
    } else {
      setRestoringId(null)
      setNotice("Couldn't restore this version. Your current text is unchanged.")
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
          maxLength={120}
          className="h-8 text-xs"
        />
        <Button type="button" size="icon-sm" onClick={handleSaveVersion} disabled={saving} aria-label="Save version">
          <FloppyDiskIcon />
        </Button>
      </div>

      {notice ? (
        <p role="alert" className="border-b border-border px-4 py-2 text-xs text-destructive">
          {notice}
        </p>
      ) : null}

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {versions === null ? (
          <p className="text-xs text-muted-foreground">
            {loadFailed ? "Couldn't load version history. Close and reopen this panel to try again." : "Loading…"}
          </p>
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
                    onClick={() => handleRestoreClick(v.id, v.label || KIND_LABEL[v.kind])}
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

      <AlertDialog open={restoreTarget !== null} onOpenChange={(open) => !open && setRestoreTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore this version?</AlertDialogTitle>
            <AlertDialogDescription>
              Restore &ldquo;{restoreTarget?.title}&rdquo;? Your current draft will be saved first,
              so nothing is lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button type="button" variant="outline" onClick={() => setRestoreTarget(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleConfirmRestore}>
              Restore
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
