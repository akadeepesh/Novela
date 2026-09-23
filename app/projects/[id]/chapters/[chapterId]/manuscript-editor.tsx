"use client"

import { useEditor, EditorContent, type Editor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import { CharacterCount } from "@tiptap/extension-character-count"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import {
  ArrowLeftIcon,
  TextBIcon,
  TextItalicIcon,
  QuotesIcon,
  GearSixIcon,
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
import { saveChapterAction } from "./actions"
import { ManuscriptSettingsPanel } from "./manuscript-settings-panel"
import { VersionHistoryPanel } from "./version-history-panel"

const SAVE_DEBOUNCE_MS = 900

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
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Shared by every mutation this page makes (content/title saves here, and
  // manuscript-settings changes below) so two of them are never genuinely
  // in flight at once — see lib/action-queue.ts for why that matters.
  const enqueue = useMemo(() => createActionQueue(), [])

  const scheduleContentSave = useCallback(
    (editor: Editor) => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
      setSaveState("saving")
      saveTimer.current = setTimeout(() => {
        const words = editor.storage.characterCount.words()
        setWordCount(words)
        enqueue(() =>
          saveChapterAction(projectId, chapter.id, {
            content: editor.getJSON(),
            wordCount: words,
          })
        )
          .then((result) => setSaveState(result.ok ? "saved" : "error"))
          .catch(() => setSaveState("error"))
      }, SAVE_DEBOUNCE_MS)
    },
    [projectId, chapter.id, enqueue]
  )

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
    onUpdate: ({ editor }) => scheduleContentSave(editor),
  })

  function handleTitleChange(value: string) {
    setTitle(value)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setSaveState("saving")
    saveTimer.current = setTimeout(() => {
      enqueue(() =>
        saveChapterAction(projectId, chapter.id, {
          title: value.trim() || "Untitled",
        })
      )
        .then((result) => setSaveState(result.ok ? "saved" : "error"))
        .catch(() => setSaveState("error"))
    }, SAVE_DEBOUNCE_MS)
  }

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [])

  const bg = getBackgroundPreset(settings.background, settings.backgroundImageUrl)

  return (
    <div className="flex h-screen flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <Link
          href={`/projects/${projectId}/chapters`}
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
          onClose={() => setHistoryOpen(false)}
        />
      ) : null}
      </div>

      <div className="flex items-center justify-between border-t border-border px-4 py-1.5 text-xs text-muted-foreground">
        <span>
          {wordCount.toLocaleString()} words
          {projectType === "script-writing" ? ` · ${estimateScriptRuntime(wordCount)}` : ""}
        </span>
        <span className={cn("italic", saveState === "error" && "text-destructive not-italic")}>
          {saveState === "saving"
            ? "Saving…"
            : saveState === "saved"
              ? "Saved"
              : saveState === "error"
                ? "Couldn't save — will retry on your next change"
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
