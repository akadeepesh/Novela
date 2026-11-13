"use client"

import { useEditor, EditorContent, type Editor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import { CharacterCount } from "@tiptap/extension-character-count"
import TextAlign from "@tiptap/extension-text-align"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeftIcon,
  ArrowCounterClockwiseIcon,
  ArrowClockwiseIcon,
  TextBIcon,
  TextItalicIcon,
  TextUnderlineIcon,
  TextStrikethroughIcon,
  TextHTwoIcon,
  TextHThreeIcon,
  QuotesIcon,
  ListBulletsIcon,
  ListNumbersIcon,
  AsteriskIcon,
  TextAlignLeftIcon,
  TextAlignCenterIcon,
  TextAlignRightIcon,
  MagnifyingGlassIcon,
  ListChecksIcon,
  ArrowsOutIcon,
  ArrowsInIcon,
  GearSixIcon,
  BookOpenIcon,
  BookOpenTextIcon,
  ClockCounterClockwiseIcon,
  ChatTeardropTextIcon,
  TreeStructureIcon,
} from "@phosphor-icons/react/dist/ssr"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import type { SerializedChapter } from "@/lib/store/chapters"
import { useImageUrl } from "@/lib/store/use-image-url"
import {
  FONT_FAMILY_CSS,
  getBackgroundPreset,
  LINE_WIDTH_PX,
  type ManuscriptSettings,
} from "@/lib/manuscript-config"
import type { ProjectType } from "@/lib/project-config"
import { FocusMode } from "@/components/editor/focus-mode-extension"
import { MentionExtension } from "@/components/editor/mention-extension"
import { FindReplace } from "@/components/editor/find-replace-extension"
import { StyleCheck } from "@/components/editor/style-check-extension"
import { useConfigureStyleCheck } from "@/components/story-check/use-style-check"
import { FindBar } from "@/components/editor/find-bar"
import { CommentMark } from "@/components/editor/comment-mark"
import { OutlinePanel } from "@/components/editor/outline-panel"
import type { Mentionable } from "@/lib/store/mentions"
import { estimateScriptRuntime } from "@/lib/script-scaffold"
import { createActionQueue } from "@/lib/action-queue"
import { useRegisterNavigationGuard } from "@/components/project/navigation-guard"
import { countWords } from "@/lib/word-count"
import { saveChapterAction, type SaveChapterInput, type SaveChapterResult } from "./actions"
import { createChapterFromDraftAction } from "../actions"
import { ManuscriptSettingsPanel } from "./manuscript-settings-panel"
import { VersionHistoryPanel } from "./version-history-panel"
import { CommentsPanel, type CommentDraft } from "./comments-panel"
import { StoryCheckPanel } from "@/components/story-check/story-check-panel"
import { revealPassage } from "@/components/editor/reveal-passage"

const SAVE_DEBOUNCE_MS = 900
// Show a "consider splitting" hint from here (the save limit is far higher).
const LONG_CHAPTER_WORDS = 50_000

type SaveFailure = Extract<SaveChapterResult, { ok: false }>["code"]

const FAILURE_MESSAGE: Record<Exclude<SaveFailure, "conflict">, string> = {
  too_large:
    "This chapter is too large to save (over 3 MB). Split it into smaller chapters. Your text is still in this tab, so copy it somewhere safe before leaving.",
  not_found:
    "This chapter can't be saved: it was deleted, or its project was moved to the Trash, in another tab. Copy your text before leaving.",
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
  /** Open with the comments panel showing (links from "new reader comments"). */
  openComments?: boolean
  /** Arrived from Story Check: open its panel, and jump to this passage if given. */
  checkTarget?: { blockIndex?: number; quote?: string } | null
}

export function ManuscriptEditor({
  projectId,
  projectType,
  chapter,
  chapterLabelSingular,
  manuscriptSettings,
  mentionables,
  openComments = false,
  checkTarget = null,
}: Props) {
  const [title, setTitle] = useState(chapter.title)
  const [focusMode, setFocusMode] = useState(false)
  // Keeps the line being typed at the middle of the screen.
  const [typewriter, setTypewriter] = useState(false)
  // Distraction-free: full screen, toolbar hidden until the pointer nears it.
  const [zen, setZen] = useState(false)
  const [findOpen, setFindOpen] = useState(false)
  const [commentsOpen, setCommentsOpen] = useState(openComments)
  const [outlineOpen, setOutlineOpen] = useState(false)
  const [checkOpen, setCheckOpen] = useState(checkTarget !== null)
  const [commentDraft, setCommentDraft] = useState<CommentDraft | null>(null)
  const [selectionWords, setSelectionWords] = useState(0)
  // Words at the start of this sitting, for the "+N this session" count.
  const [sessionStart] = useState(chapter.wordCount)
  const rootRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const typewriterRef = useRef(false)
  useEffect(() => {
    typewriterRef.current = typewriter
  }, [typewriter])
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
  // An empty id means a draft: nothing exists in the database until the first
  // change, which creates the chapter (see flush) and fills these in.
  const chapterIdRef = useRef(chapter.id)
  const [chapterId, setChapterId] = useState(chapter.id)
  const latestTitle = useRef(chapter.title)
  // While true, autosave is paused until the person chooses Keep mine / Load theirs.
  const conflictRef = useRef(false)
  const forceNext = useRef(false)
  // The newest save that hasn't finished yet. Anything that must see the
  // saved text (version history, leaving the page) waits on this, not just
  // on "is anything still in the debounce window".
  const inFlight = useRef<Promise<boolean> | null>(null)

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
      // Same function the store uses, so the footer matches the saved count.
      setWordCount(countWords(input.content))
    }
    // Nothing new to send, but an earlier save may still be on its way:
    // callers must wait for that one, or they'd act on text not yet saved.
    if (Object.keys(input).length === 0) return inFlight.current ?? Promise.resolve(true)

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
    const save = enqueue(async (): Promise<SaveChapterResult> => {
      if (chapterIdRef.current) {
        return saveChapterAction(projectId, chapterIdRef.current, {
          ...input,
          baseVersion: versionRef.current,
        })
      }
      // First change to a draft: create the chapter now, with everything typed so far.
      const created = await createChapterFromDraftAction(projectId, {
        title: input.title ?? latestTitle.current,
        content: input.content ?? editorRef.current?.getJSON(),
      })
      if (!created.ok) return created
      chapterIdRef.current = created.id
      setChapterId(created.id)
      // Same page, real address: a reload or Back now lands on the saved chapter.
      // Only while still on the draft page: if the person already navigated
      // away, leave the address bar alone.
      if (window.location.pathname.endsWith("/chapters/new")) {
        window.history.replaceState(null, "", `/projects/${projectId}/chapters/${created.id}`)
      }
      return { ok: true, version: created.version }
    })
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
    inFlight.current = save
    void save.finally(() => {
      if (inFlight.current === save) inFlight.current = null
    })
    return save
  }, [projectId, enqueue])

  const isPending = useCallback(
    () => contentDirty.current || pendingTitle.current !== null || inFlight.current !== null,
    []
  )
  const navigationGuard = useMemo(() => ({ isPending, flush }), [isPending, flush])
  useRegisterNavigationGuard(navigationGuard)

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
    if (!isPending()) return
    e.preventDefault()
    void flush().then((ok) => {
      if (ok) router.push(href)
    })
  }

  /** Goes to another page, saving pending changes first. */
  function navigate(href: string) {
    if (!isPending()) {
      router.push(href)
      return
    }
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
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      FindReplace,
      CommentMark,
      StyleCheck,
    ],
    content: (chapter.content as object | string | null) ?? "",
    onCreate: ({ editor }) => {
      editorRef.current = editor
    },
    onUpdate: ({ editor }) => {
      editorRef.current = editor
      contentDirty.current = true
      scheduleSave()
    },
    onSelectionUpdate: ({ editor }) => {
      const { from, to, empty } = editor.state.selection
      setSelectionWords(empty ? 0 : countPlainWords(editor.state.doc.textBetween(from, to, " ", " ")))
      if (typewriterRef.current) centerCaret(editor, scrollRef.current)
    },
  })

  useConfigureStyleCheck(editor, projectId, checkOpen)

  // Ctrl/Cmd+F opens find & replace while this page is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === "f") {
        e.preventDefault()
        setFindOpen(true)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  // Leaving full screen with Esc (or the browser's own control) ends zen mode too.
  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) setZen(false)
    }
    document.addEventListener("fullscreenchange", onChange)
    return () => document.removeEventListener("fullscreenchange", onChange)
  }, [])

  // Comment on the selected passage: opens the comments panel with a draft.
  function startComment() {
    const ed = editorRef.current
    if (!ed) return
    const { from, to, empty } = ed.state.selection
    if (empty) return
    setCommentDraft({ from, to, quote: ed.state.doc.textBetween(from, to, " ", " ") })
    setHistoryOpen(false)
    setOutlineOpen(false)
    setCommentsOpen(true)
  }

  function toggleZen() {
    if (zen) {
      setZen(false)
      if (document.fullscreenElement) void document.exitFullscreen()
      return
    }
    setZen(true)
    // Full screen where the browser allows it; zen styling works either way.
    void rootRef.current?.requestFullscreen?.().catch(() => {})
  }

  function handleTitleChange(value: string) {
    setTitle(value)
    latestTitle.current = value
    pendingTitle.current = value
    scheduleSave()
  }

  useEffect(() => {
    const onHide = () => void flush()
    // Warn while something is unsaved, a save failed, or a save is still
    // in flight (closing the tab would abort it).
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isPending()) {
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
  }, [flush, isPending])

  const backgroundImageUrl = useImageUrl(settings.backgroundImageUrl)
  // Arrived from a Story Check "Go to text" in another chapter.
  const revealed = useRef(false)
  useEffect(() => {
    if (!editor || revealed.current || !checkTarget || (checkTarget.blockIndex === undefined && !checkTarget.quote)) return
    revealed.current = true
    revealPassage(editor, checkTarget.blockIndex, checkTarget.quote)
  }, [editor, checkTarget])

  const bg = getBackgroundPreset(settings.background, backgroundImageUrl)
  // A draft has no chapter yet, so Read opens the whole book instead.
  const readHref = chapterId ? `/read/${projectId}?chapter=${chapterId}` : `/read/${projectId}`

  const sessionWords = Math.max(0, wordCount - sessionStart)

  return (
    <div ref={rootRef} className={cn("flex h-screen flex-col bg-background", zen && "is-zen")}>
      <div
        className={cn(
          "flex items-center justify-between gap-2 border-b border-border px-4 py-2",
          zen && "opacity-0 transition-opacity duration-300 hover:opacity-100 focus-within:opacity-100"
        )}
      >
        <Link
          href={`/projects/${projectId}/chapters`}
          onClick={(e) => leave(e, `/projects/${projectId}/chapters`)}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon className="size-3.5" />
          Back
        </Link>

        <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
          {editor ? <FormattingToolbar editor={editor} /> : null}

          <div className="mx-1 h-5 w-px shrink-0 bg-border" />

          <ToolbarButton label="Find and replace (Ctrl+F)" active={findOpen} onClick={() => setFindOpen((v) => !v)}>
            <MagnifyingGlassIcon />
          </ToolbarButton>
          <ToolbarButton
            label={selectionWords > 0 ? "Comment on selection" : "Comments"}
            active={commentsOpen}
            disabled={!chapterId}
            onClick={() => {
              if (selectionWords > 0) startComment()
              else {
                setHistoryOpen(false)
                setOutlineOpen(false)
                setCheckOpen(false)
                setCommentsOpen((v) => !v)
              }
            }}
          >
            <ChatTeardropTextIcon />
          </ToolbarButton>
          <ToolbarButton
            label="Outline: scenes and headings"
            active={outlineOpen}
            onClick={() => {
              setHistoryOpen(false)
              setCommentsOpen(false)
              setCheckOpen(false)
              setOutlineOpen((v) => !v)
            }}
          >
            <TreeStructureIcon />
          </ToolbarButton>
          <ToolbarButton
            label="Story Check: continuity and plot holes"
            active={checkOpen}
            onClick={() => {
              setHistoryOpen(false)
              setCommentsOpen(false)
              setOutlineOpen(false)
              setCheckOpen((v) => !v)
            }}
          >
            <ListChecksIcon />
          </ToolbarButton>

          <Button
            size="sm"
            variant="ghost"
            render={
              <Link
                href={readHref}
                onClick={(e) => leave(e, readHref)}
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
            title="Dim everything but the paragraph you're writing"
          >
            <BookOpenTextIcon />
            Focus
          </Button>
          <Button
            type="button"
            size="sm"
            variant={typewriter ? "secondary" : "ghost"}
            onClick={() => setTypewriter((v) => !v)}
            title="Keep the line you're typing in the middle of the screen"
          >
            Typewriter
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant={zen ? "secondary" : "ghost"}
            onClick={toggleZen}
            aria-label={zen ? "Exit distraction-free mode" : "Distraction-free mode"}
            title={zen ? "Exit distraction-free mode" : "Distraction-free mode"}
          >
            {zen ? <ArrowsInIcon /> : <ArrowsOutIcon />}
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant={historyOpen ? "secondary" : "ghost"}
            onClick={() => {
              setCommentsOpen(false)
              setOutlineOpen(false)
              setCheckOpen(false)
              setHistoryOpen((v) => !v)
            }}
            disabled={!chapterId}
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

      {findOpen && editor ? <FindBar editor={editor} onClose={() => setFindOpen(false)} /> : null}

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
      <div ref={scrollRef} className="flex-1 overflow-y-auto" style={bg.style}>
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
            style={{
              fontSize: settings.fontSize,
              lineHeight: settings.lineHeight,
              fontFamily: FONT_FAMILY_CSS[settings.fontFamily] ?? FONT_FAMILY_CSS.serif,
            }}
          />

          {settings.showFooter ? (
            <p className="mt-10 text-center text-xs opacity-50">{settings.footerText}</p>
          ) : null}
        </div>
      </div>

      {outlineOpen && editor ? <OutlinePanel editor={editor} onClose={() => setOutlineOpen(false)} /> : null}

      {commentsOpen && editor && chapterId ? (
        <CommentsPanel
          editor={editor}
          projectId={projectId}
          chapterId={chapterId}
          draft={commentDraft}
          onDraftDone={() => setCommentDraft(null)}
          enqueue={enqueue}
          onClose={() => {
            setCommentsOpen(false)
            setCommentDraft(null)
          }}
        />
      ) : null}

      {checkOpen && editor ? (
        <StoryCheckPanel
          projectId={projectId}
          chapterId={chapterId}
          editor={editor}
          onNavigate={navigate}
          onClose={() => setCheckOpen(false)}
        />
      ) : null}

      {historyOpen && editor ? (
        <VersionHistoryPanel
          projectId={projectId}
          chapterId={chapterId}
          getCurrentContent={() => editor.getJSON()}
          flushPending={flush}
          enqueue={enqueue}
          onClose={() => setHistoryOpen(false)}
        />
      ) : null}
      </div>

      <div
        className={cn(
          "flex items-center justify-between gap-4 border-t border-border px-4 py-1.5 text-xs text-muted-foreground",
          zen && "border-transparent"
        )}
      >
        <span>
          {wordCount.toLocaleString()} words
          {selectionWords > 0 ? ` · ${selectionWords.toLocaleString()} selected` : ""}
          {sessionWords > 0 ? ` · +${sessionWords.toLocaleString()} this session` : ""}
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
  disabled,
  label,
  onClick,
  children,
}: {
  active?: boolean
  disabled?: boolean
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
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className="shrink-0"
    >
      {children}
    </Button>
  )
}

function countPlainWords(text: string): number {
  return text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length
}

/** Typewriter scrolling: put the caret's line at the vertical middle of the page. */
function centerCaret(editor: Editor, container: HTMLElement | null) {
  if (!container) return
  const { head } = editor.state.selection
  let caretTop: number
  try {
    caretTop = editor.view.coordsAtPos(head).top
  } catch {
    return
  }
  const box = container.getBoundingClientRect()
  const offset = caretTop - (box.top + box.height / 2)
  if (Math.abs(offset) > 4) container.scrollBy({ top: offset, behavior: "smooth" })
}

/** Formatting buttons. Each reflects whether it's applied at the cursor. */
function FormattingToolbar({ editor }: { editor: Editor }) {
  // Re-render on every transaction so active states follow the cursor.
  const [, rerender] = useState(0)
  useEffect(() => {
    const update = () => rerender((n) => n + 1)
    editor.on("transaction", update)
    return () => {
      editor.off("transaction", update)
    }
  }, [editor])

  const chain = () => editor.chain().focus()
  const isAligned = (align: string) => editor.isActive({ textAlign: align })

  return (
    <>
      <ToolbarButton label="Undo (Ctrl+Z)" onClick={() => chain().undo().run()} disabled={!editor.can().undo()}>
        <ArrowCounterClockwiseIcon />
      </ToolbarButton>
      <ToolbarButton label="Redo (Ctrl+Shift+Z)" onClick={() => chain().redo().run()} disabled={!editor.can().redo()}>
        <ArrowClockwiseIcon />
      </ToolbarButton>
      <ToolbarDivider />
      <ToolbarButton
        label="Heading"
        active={editor.isActive("heading", { level: 2 })}
        onClick={() => chain().toggleHeading({ level: 2 }).run()}
      >
        <TextHTwoIcon />
      </ToolbarButton>
      <ToolbarButton
        label="Subheading"
        active={editor.isActive("heading", { level: 3 })}
        onClick={() => chain().toggleHeading({ level: 3 }).run()}
      >
        <TextHThreeIcon />
      </ToolbarButton>
      <ToolbarDivider />
      <ToolbarButton label="Bold (Ctrl+B)" active={editor.isActive("bold")} onClick={() => chain().toggleBold().run()}>
        <TextBIcon />
      </ToolbarButton>
      <ToolbarButton label="Italic (Ctrl+I)" active={editor.isActive("italic")} onClick={() => chain().toggleItalic().run()}>
        <TextItalicIcon />
      </ToolbarButton>
      <ToolbarButton
        label="Underline (Ctrl+U)"
        active={editor.isActive("underline")}
        onClick={() => chain().toggleUnderline().run()}
      >
        <TextUnderlineIcon />
      </ToolbarButton>
      <ToolbarButton label="Strikethrough" active={editor.isActive("strike")} onClick={() => chain().toggleStrike().run()}>
        <TextStrikethroughIcon />
      </ToolbarButton>
      <ToolbarDivider />
      <ToolbarButton label="Quote" active={editor.isActive("blockquote")} onClick={() => chain().toggleBlockquote().run()}>
        <QuotesIcon />
      </ToolbarButton>
      <ToolbarButton
        label="Bulleted list"
        active={editor.isActive("bulletList")}
        onClick={() => chain().toggleBulletList().run()}
      >
        <ListBulletsIcon />
      </ToolbarButton>
      <ToolbarButton
        label="Numbered list"
        active={editor.isActive("orderedList")}
        onClick={() => chain().toggleOrderedList().run()}
      >
        <ListNumbersIcon />
      </ToolbarButton>
      <ToolbarButton label="Scene break" onClick={() => chain().setHorizontalRule().run()}>
        <AsteriskIcon />
      </ToolbarButton>
      <ToolbarDivider />
      <ToolbarButton
        label="Align left"
        active={!isAligned("center") && !isAligned("right")}
        onClick={() => chain().unsetTextAlign().run()}
      >
        <TextAlignLeftIcon />
      </ToolbarButton>
      <ToolbarButton label="Centre" active={isAligned("center")} onClick={() => chain().setTextAlign("center").run()}>
        <TextAlignCenterIcon />
      </ToolbarButton>
      <ToolbarButton label="Align right" active={isAligned("right")} onClick={() => chain().setTextAlign("right").run()}>
        <TextAlignRightIcon />
      </ToolbarButton>
    </>
  )
}

function ToolbarDivider() {
  return <div className="mx-0.5 h-5 w-px shrink-0 bg-border" />
}
