"use client"

import { useEditor, EditorContent, type Editor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import { CharacterCount } from "@tiptap/extension-character-count"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeftIcon,
  TextBIcon,
  TextItalicIcon,
  QuotesIcon,
  GearSixIcon,
  BookOpenIcon,
  BookOpenTextIcon,
  ClockCounterClockwiseIcon,
} from "@phosphor-icons/react/dist/ssr"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import type { SerializedChapter } from "@/lib/chapters"
import { getBackgroundPreset, LINE_WIDTH_PX, type ManuscriptSettings } from "@/lib/manuscript-config"
import type { ProjectType } from "@/lib/project-config"
import { FocusMode } from "@/components/editor/focus-mode-extension"
import { MentionExtension } from "@/components/editor/mention-extension"
import type { Mentionable } from "@/lib/mentions"
import { estimateScriptRuntime } from "@/lib/script-scaffold"
import { createActionQueue } from "@/lib/action-queue"
import { countWords } from "@/lib/word-count"
import { saveChapterAction, type SaveChapterInput, type SaveChapterResult } from "./actions"
import { ManuscriptSettingsPanel } from "./manuscript-settings-panel"
import { VersionHistoryPanel } from "./version-history-panel"

const SAVE_DEBOUNCE_MS = 900
// Show a "consider splitting" hint from here (the server hard-limit is far higher).
const LONG_CHAPTER_WORDS = 50_000

type SaveFailure = Extract<SaveChapterResult, { ok: false }>["code"]

const FAILURE_MESSAGE: Record<Exclude<SaveFailure, "conflict">, string> = {
  too_large:
    "This chapter is too large to save (over 3 MB). Split it into smaller chapters. Your text is still in this tab, so copy it somewhere safe before leaving.",
  not_found: "This chapter no longer exists. It may have been deleted in another tab. Copy your text before leaving.",
  invalid: "Couldn't save this text. Copy it somewhere safe and let us know.",
  error: "Couldn't save. Your text is still in this tab and will be retried on your next change.",
}

type Props = {
  projectId: string
  projectType: ProjectType
  chapter: SerializedChapter
  chapterLabelSingular: string
  manuscriptSettings: ManuscriptSettings
  mentionables: Mentionable[]
}

export function ManuscriptEditor({
  projectId,
  projectType,
  chapter,
  chapterLabelSingular,
  manuscriptSettings,
  mentionables,
}: Props) {
  const [title, setTitle] = useState(chapter.title)
  const [focusMode, setFocusMode] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [settings, setSettings] = useState(manuscriptSettings)
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [wordCount, setWordCount] = useState(chapter.wordCount)
  const [conflict, setConflict] = useState(false)
  const [failure, setFailure] = useState<SaveFailure | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Shared by every mutation this page makes (content/title saves here, and
  // manuscript-settings changes below) so two of them are never genuinely
  // in flight at once — see lib/action-queue.ts for why that matters.
  const enqueue = useMemo(() => createActionQueue(), [])

  const router = useRouter()
  const editorRef = useRef<Editor | null>(null)
  const pendingTitle = useRef<string | null>(null)
  const contentDirty = useRef(false)
  // Version of the saved chapter this editor is based on. Sent with every save
  // so a save from a stale tab is rejected instead of overwriting newer text.
  const versionRef = useRef(chapter.version)
  // While true, autosave is paused until the person chooses Keep mine / Load theirs.
  const conflictRef = useRef(false)
  const forceNext = useRef(false)

  // Sends whatever is pending (title and/or body) as ONE save, right now.
  // Called by the debounce timer, before in-app navigation, and on unmount /
  // page hide, so the last moments of typing are never thrown away.
  const flush = useCallback((): Promise<boolean> => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current)
      saveTimer.current = null
    }
    // Paused on conflict: nothing is sent, and the pending changes stay pending.
    if (conflictRef.current) return Promise.resolve(false)

    const input: SaveChapterInput = {}
    if (pendingTitle.current !== null) {
      input.title = pendingTitle.current.trim() || "Untitled"
      pendingTitle.current = null
    }
    if (contentDirty.current && editorRef.current) {
      input.content = editorRef.current.getJSON()
      contentDirty.current = false
      // Same function the server uses, so the footer matches the saved count.
      setWordCount(countWords(input.content))
    }
    if (Object.keys(input).length === 0) return Promise.resolve(true)

    if (forceNext.current) {
      input.force = true
      forceNext.current = false
    }

    setSaveState("saving")
    const restore = (code: SaveFailure) => {
      // Keep failed changes pending so the next change (or exit) retries them.
      if (input.content !== undefined) contentDirty.current = true
      if (input.title !== undefined && pendingTitle.current === null) pendingTitle.current = input.title
      if (code === "conflict") {
        conflictRef.current = true
        setConflict(true)
      }
      setFailure(code)
      setSaveState("error")
    }
    // baseVersion is read when the save actually runs (the queue may delay it
    // behind an earlier save that bumps the version).
    return enqueue(() =>
      saveChapterAction(projectId, chapter.id, { ...input, baseVersion: versionRef.current })
    )
      .then((result) => {
        if (result.ok) {
          versionRef.current = result.version
          setFailure(null)
          setSaveState("saved")
          return true
        }
        restore(result.code)
        return false
      })
      .catch(() => {
        restore("error")
        return false
      })
  }, [projectId, chapter.id, enqueue])

  const scheduleSave = useCallback(() => {
    if (conflictRef.current) return
    setSaveState("saving")
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => void flush(), SAVE_DEBOUNCE_MS)
  }, [flush])

  // In-app links: finish saving first, then navigate, so the next page
  // (Read view, chapter list) always loads the latest text. If the save fails
  // we stay put, so the text isn't silently dropped.
  function leave(e: React.MouseEvent, href: string) {
    if (!contentDirty.current && pendingTitle.current === null) return
    e.preventDefault()
    void flush().then((ok) => {
      if (ok) router.push(href)
    })
  }

  // Conflict: another tab or device saved this chapter after this one loaded.
  function keepMine() {
    conflictRef.current = false
    setConflict(false)
    forceNext.current = true
    void flush()
  }

  function loadTheirs() {
    contentDirty.current = false
    pendingTitle.current = null
    window.location.reload()
  }

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: `Start writing your ${chapterLabelSingular.toLowerCase()}…`,
      }),
      CharacterCount,
      FocusMode,
      MentionExtension.configure({ mentionables }),
    ],
    content: (chapter.content as object | string | null) ?? "",
    onUpdate: ({ editor }) => {
      editorRef.current = editor
      contentDirty.current = true
      scheduleSave()
    },
  })

  function handleTitleChange(value: string) {
    setTitle(value)
    pendingTitle.current = value
    scheduleSave()
  }

  useEffect(() => {
    const onHide = () => void flush()
    // Warn only while something is still unsaved (or a save failed).
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (contentDirty.current || pendingTitle.current !== null) {
        e.preventDefault()
        e.returnValue = ""
      }
    }
    window.addEventListener("pagehide", onHide)
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => {
      window.removeEventListener("pagehide", onHide)
      window.removeEventListener("beforeunload", onBeforeUnload)
      void flush()
    }
  }, [flush])

  const bg = getBackgroundPreset(settings.background, settings.backgroundImageUrl)

  return (
    <div className="flex h-screen flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <Link
          href={`/projects/${projectId}/chapters`}
          onClick={(e) => leave(e, `/projects/${projectId}/chapters`)}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon className="size-3.5" />
          Back
        </Link>

        <div className="flex items-center gap-1">
          {editor ? (
            <>
              <ToolbarButton
                active={editor.isActive("bold")}
                label="Bold"
                onClick={() => editor.chain().focus().toggleBold().run()}
              >
                <TextBIcon />
              </ToolbarButton>
              <ToolbarButton
                active={editor.isActive("italic")}
                label="Italic"
                onClick={() => editor.chain().focus().toggleItalic().run()}
              >
                <TextItalicIcon />
              </ToolbarButton>
              <ToolbarButton
                active={editor.isActive("blockquote")}
                label="Quote"
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
              >
                <QuotesIcon />
              </ToolbarButton>
            </>
          ) : null}

          <div className="mx-1 h-5 w-px bg-border" />

          <Button
            size="sm"
            variant="ghost"
            render={
              <Link
                href={`/read/${projectId}?chapter=${chapter.id}`}
                onClick={(e) => leave(e, `/read/${projectId}?chapter=${chapter.id}`)}
              />
            }
            nativeButton={false}
          >
            <BookOpenIcon />
            Read
          </Button>
          <Button
            type="button"
            size="sm"
            variant={focusMode ? "secondary" : "ghost"}
            onClick={() => setFocusMode((v) => !v)}
          >
            <BookOpenTextIcon />
            Focus
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant={historyOpen ? "secondary" : "ghost"}
            onClick={() => setHistoryOpen((v) => !v)}
            aria-label="Version history"
          >
            <ClockCounterClockwiseIcon />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant={settingsOpen ? "secondary" : "ghost"}
            onClick={() => setSettingsOpen((v) => !v)}
            aria-label="Page appearance"
          >
            <GearSixIcon />
          </Button>
        </div>
      </div>

      {conflict ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-destructive/10 px-4 py-2 text-sm"
        >
          <p className="text-foreground">
            This {chapterLabelSingular.toLowerCase()} was changed in another tab or on another device.
            Saving is paused so nothing is overwritten.
          </p>
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" variant="outline" onClick={loadTheirs}>
              Load their version
            </Button>
            <Button type="button" size="sm" onClick={keepMine}>
              Keep mine
            </Button>
          </div>
        </div>
      ) : null}

      {settingsOpen ? (
        <ManuscriptSettingsPanel
          projectId={projectId}
          settings={settings}
          onChange={setSettings}
          onClose={() => setSettingsOpen(false)}
          enqueue={enqueue}
        />
      ) : null}

      <div className="flex flex-1 overflow-hidden">
      <div className="flex-1 overflow-y-auto" style={bg.style}>
        <div
          className="mx-auto flex flex-col px-8 py-12"
          style={{ maxWidth: LINE_WIDTH_PX[settings.lineWidth] }}
        >
          {settings.showHeader ? (
            <p className="mb-10 text-center text-xs tracking-widest uppercase opacity-50">
              {settings.headerText || title || "Untitled"}
            </p>
          ) : null}

          <input
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder={`Untitled ${chapterLabelSingular}`}
            className="mb-6 w-full bg-transparent font-heading text-2xl font-semibold outline-none placeholder:opacity-40"
          />

          <EditorContent
            editor={editor}
            className={cn(
              "manuscript-prose",
              projectType === "poetry" && "is-poetry",
              focusMode && "focus-mode"
            )}
            style={{ fontSize: settings.fontSize, lineHeight: settings.lineHeight }}
          />

          {settings.showFooter ? (
            <p className="mt-10 text-center text-xs opacity-50">{settings.footerText}</p>
          ) : null}
        </div>
      </div>

      {historyOpen && editor ? (
        <VersionHistoryPanel
          projectId={projectId}
          chapterId={chapter.id}
          getCurrentContent={() => editor.getJSON()}
          flushPending={flush}
          onClose={() => setHistoryOpen(false)}
        />
      ) : null}
      </div>

      <div className="flex items-center justify-between border-t border-border px-4 py-1.5 text-xs text-muted-foreground">
        <span>
          {wordCount.toLocaleString()} words
          {projectType === "script-writing" ? ` · ${estimateScriptRuntime(wordCount)}` : ""}
          {wordCount >= LONG_CHAPTER_WORDS ? " · Very long. Consider splitting it into smaller chapters." : ""}
        </span>
        <span className={cn("italic", saveState === "error" && "text-destructive not-italic")}>
          {saveState === "saving"
            ? "Saving…"
            : saveState === "saved"
              ? "Saved"
              : saveState === "error"
                ? failure === "conflict"
                  ? "Saving paused"
                  : FAILURE_MESSAGE[failure ?? "error"]
                : ""}
        </span>
      </div>
    </div>
  )
}

function ToolbarButton({
  active,
  label,
  onClick,
  children,
}: {
  active?: boolean
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Button
      type="button"
      size="icon-sm"
      variant={active ? "secondary" : "ghost"}
      onClick={onClick}
      aria-label={label}
    >
      {children}
    </Button>
  )
}
