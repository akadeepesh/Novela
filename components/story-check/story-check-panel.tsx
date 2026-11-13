"use client"

import { useState } from "react"
import type { Editor } from "@tiptap/react"
import { cn } from "cn"
import { ListChecksIcon, XIcon } from "@phosphor-icons/react/dist/ssr"
import { revealPassage } from "@/components/editor/reveal-passage"
import { useStoryCheck } from "@/lib/story-check/use-story-check"
import { RULES, type Issue } from "@/lib/story-check/types"
import { updateStoryCheckSettings } from "@/lib/store/projects"
import { useChapters, useProject } from "@/lib/store/hooks"
import { updateChapterMetaAction } from "@/app/projects/[id]/chapters/actions"

type Tab = "chapter" | "book"

/** The address that opens a chapter and jumps to an issue's passage. */
export function issueHref(projectId: string, issue: Issue): string | null {
  const loc = issue.location
  if (!loc) return null
  const base = `/projects/${projectId}/chapters/${loc.chapterId}`
  if (loc.blockIndex === undefined && !loc.quote) return `${base}?check=1`
  const target = `${loc.blockIndex ?? ""}:${loc.quote ?? ""}`
  return `${base}?check=${encodeURIComponent(target)}`
}

/**
 * The editor's Story Check panel: continuity issues for this chapter and
 * the whole book, each with Go to text, Ignore, and Ignore for this
 * character/place/thread.
 */
export function StoryCheckPanel({
  projectId,
  chapterId,
  editor,
  onNavigate,
  onClose,
}: {
  projectId: string
  /** Empty for a draft that hasn't been saved yet. */
  chapterId: string
  editor: Editor
  /** Leaves the editor safely (saving first) for another chapter. */
  onNavigate: (href: string) => void
  onClose: () => void
}) {
  const { issues, checking, ready } = useStoryCheck(projectId)
  const [tab, setTab] = useState<Tab>(chapterId ? "chapter" : "book")
  const [notice, setNotice] = useState<string | null>(null)
  const project = useProject(projectId)
  const settings = project?.storyCheck
  const ignoredCount = settings
    ? settings.ignoredIssues.length + Object.values(settings.ignoredRules).reduce((n, r) => n + r.length, 0) + settings.ignoredNames.length
    : 0

  const here = issues.filter((i) => i.location?.chapterId === chapterId)
  const shown = tab === "chapter" ? here : issues
  const warnings = shown.filter((i) => i.severity === "warning")
  const notes = shown.filter((i) => i.severity === "info")

  function goTo(issue: Issue) {
    setNotice(null)
    const loc = issue.location
    if (!loc) return
    if (loc.chapterId === chapterId) {
      if (!revealPassage(editor, loc.blockIndex, loc.quote)) setNotice("Couldn't find that passage any more. It may have changed.")
      return
    }
    const href = issueHref(projectId, issue)
    if (href) onNavigate(href)
  }

  function ignore(issue: Issue) {
    void updateStoryCheckSettings(projectId, (s) =>
      issue.rule === "name-drift" && issue.location?.quote
        ? { ...s, ignoredNames: [...new Set([...s.ignoredNames, issue.location.quote])] }
        : { ...s, ignoredIssues: [...new Set([...s.ignoredIssues, issue.key])] }
    )
  }

  function ignoreRuleFor(issue: Issue) {
    if (!issue.entity) return
    const id = issue.entity.id
    void updateStoryCheckSettings(projectId, (s) => ({
      ...s,
      ignoredRules: { ...s.ignoredRules, [id]: [...new Set([...(s.ignoredRules[id] ?? []), issue.rule])] },
    }))
  }

  function resetIgnored() {
    void updateStoryCheckSettings(projectId, (s) => ({ ...s, ignoredIssues: [], ignoredRules: {}, ignoredNames: [] }))
  }

  return (
    <div className="flex h-full w-80 shrink-0 flex-col border-l border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          <ListChecksIcon className="size-4" />
          Story Check
          {checking && ready ? <span className="text-xs font-normal text-muted-foreground">checking…</span> : null}
        </p>
        <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Close Story Check">
          <XIcon className="size-4" />
        </button>
      </div>

      <div role="tablist" className="flex gap-1 border-b border-border px-3 py-2">
        <TabButton active={tab === "chapter"} disabled={!chapterId} onClick={() => setTab("chapter")}>
          This chapter ({here.length})
        </TabButton>
        <TabButton active={tab === "book"} onClick={() => setTab("book")}>
          Whole book ({issues.length})
        </TabButton>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        {tab === "chapter" && chapterId ? <ChapterTime projectId={projectId} chapterId={chapterId} /> : null}

        {notice ? <p className="mb-2 text-xs text-destructive">{notice}</p> : null}

        {!ready ? (
          <p className="text-sm text-muted-foreground">Reading your book…</p>
        ) : shown.length === 0 ? (
          <div className="flex flex-col gap-2 py-6 text-center text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Nothing to report</p>
            <p className="text-xs">
              Story Check compares your text with the Story facts on characters, the plot threads,
              and the dates on your chapters. Fill those in to catch more.
            </p>
          </div>
        ) : (
          <>
            {warnings.length > 0 ? (
              <IssueList title="Worth a look" issues={warnings} showChapter={tab === "book"} onGo={goTo} onIgnore={ignore} onIgnoreRule={ignoreRuleFor} />
            ) : null}
            {notes.length > 0 ? (
              <IssueList title="Notes" issues={notes} showChapter={tab === "book"} onGo={goTo} onIgnore={ignore} onIgnoreRule={ignoreRuleFor} />
            ) : null}
          </>
        )}
      </div>

      <div className="flex flex-col gap-2 border-t border-border px-4 py-3 text-xs text-muted-foreground">
        <label className="flex items-center justify-between gap-2">
          Flag characters missing for
          <span className="flex items-center gap-1">
            <input
              type="number"
              min={2}
              max={50}
              value={settings?.forgottenAfterChapters ?? 8}
              onChange={(e) => {
                const n = Math.min(50, Math.max(2, Number(e.target.value) || 8))
                void updateStoryCheckSettings(projectId, (s) => ({ ...s, forgottenAfterChapters: n }))
              }}
              className="w-12 rounded border border-border bg-transparent px-1 py-0.5 text-right text-foreground"
            />
            chapters
          </span>
        </label>
        {ignoredCount > 0 ? (
          <p className="flex items-center justify-between">
            {ignoredCount} ignored
            <button type="button" onClick={resetIgnored} className="font-medium text-primary hover:underline">
              Show them again
            </button>
          </p>
        ) : null}
        <p>Runs on this device. Nothing is sent anywhere.</p>
      </div>
    </div>
  )
}

function TabButton({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-md px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-40",
        active ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  )
}

function IssueList({
  title,
  issues,
  showChapter,
  onGo,
  onIgnore,
  onIgnoreRule,
}: {
  title: string
  issues: Issue[]
  showChapter: boolean
  onGo: (issue: Issue) => void
  onIgnore: (issue: Issue) => void
  onIgnoreRule: (issue: Issue) => void
}) {
  return (
    <section className="mb-4">
      <h3 className="mb-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{title}</h3>
      <ul className="flex flex-col gap-2">
        {issues.map((issue) => (
          <li key={issue.key} className="rounded-md border border-border p-2.5">
            <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
              <span
                className={cn("size-1.5 rounded-full", issue.severity === "warning" ? "bg-amber-500" : "bg-sky-500")}
                aria-hidden
              />
              {RULES[issue.rule].label}
              {showChapter && issue.location ? <span className="truncate font-normal">· {issue.location.chapterTitle}</span> : null}
            </p>
            <p className="mt-1 text-sm text-foreground">{issue.message}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
              {issue.location ? (
                <button type="button" onClick={() => onGo(issue)} className="text-[11px] font-medium text-primary hover:underline">
                  {issue.location.quote ? "Go to text" : "Open chapter"}
                </button>
              ) : null}
              <button type="button" onClick={() => onIgnore(issue)} className="text-[11px] font-medium text-muted-foreground hover:text-foreground">
                {issue.rule === "name-drift" ? "Not a typo" : "Ignore"}
              </button>
              {issue.entity && issue.rule !== "name-drift" ? (
                <button
                  type="button"
                  onClick={() => onIgnoreRule(issue)}
                  className="text-[11px] font-medium text-muted-foreground hover:text-foreground"
                  title={`Stop checking “${RULES[issue.rule].label}” for ${issue.entity.name}`}
                >
                  Ignore for {issue.entity.name}
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** This chapter's flashback flag and story date, editable right here. */
function ChapterTime({ projectId, chapterId }: { projectId: string; chapterId: string }) {
  const chapter = useChapters(projectId)?.find((c) => c.id === chapterId)
  const [date, setDate] = useState<string | null>(null)
  if (!chapter) return null
  const value = date ?? chapter.storyDate
  const valid = /^(-?\d{1,4}(-\d{2}(-\d{2})?)?)?$/.test(value.trim())

  return (
    <div className="mb-3 flex items-center gap-3 rounded-md bg-muted/50 px-2.5 py-2 text-xs text-muted-foreground">
      <label className="flex items-center gap-1.5">
        <input
          type="checkbox"
          checked={chapter.flashback}
          onChange={(e) => void updateChapterMetaAction(projectId, chapterId, { flashback: e.target.checked })}
          className="size-3.5 accent-primary"
        />
        Flashback
      </label>
      <label className="flex min-w-0 flex-1 items-center gap-1.5">
        Year
        <input
          value={value}
          onChange={(e) => setDate(e.target.value)}
          onBlur={() => {
            if (valid && value.trim() !== chapter.storyDate) void updateChapterMetaAction(projectId, chapterId, { storyDate: value.trim() })
            setDate(null)
          }}
          placeholder="e.g. 2015"
          aria-invalid={!valid}
          title="When this chapter takes place: a year, or year-month-day. Used to check ages."
          className={cn("w-full min-w-0 rounded border border-border bg-transparent px-1.5 py-0.5 text-foreground", !valid && "border-destructive")}
        />
      </label>
    </div>
  )
}
