"use client"

import { useState } from "react"
import type { Editor } from "@tiptap/react"
import { cn } from "cn"
import { CaretDownIcon, CaretRightIcon } from "@phosphor-icons/react/dist/ssr"
import { revealFinding } from "@/components/editor/style-check-extension"
import { updateStyleSettings } from "@/lib/store/projects"
import { DEFAULT_FILLER_WORDS, STYLE_RULE_IDS, STYLE_RULES, type ChapterStats, type StyleFinding, type StyleRuleId, type StyleSettings } from "@/lib/style-check/types"
import { useStyleCheckResults } from "./use-style-check"

/** Show this many findings per check before "Show all". */
const PREVIEW = 8

/** The Style tab: chapter stats, findings grouped by check, and the settings. */
export function StyleTab({ projectId, editor }: { projectId: string; editor: Editor }) {
  const state = useStyleCheckResults(editor)
  const [notice, setNotice] = useState<string | null>(null)
  if (!state?.stats) return <p className="text-sm text-muted-foreground">Reading this chapter…</p>
  const { findings, stats, config } = state
  const settings = config.settings

  const change = (fn: (s: StyleSettings) => StyleSettings) => void updateStyleSettings(projectId, fn)
  const goTo = (f: StyleFinding) => {
    setNotice(revealFinding(editor.view, f.key) ? null : "Couldn't find that passage any more. It may have changed.")
  }
  const ignore = (f: StyleFinding) => change((s) => ({ ...s, ignored: [...new Set([...s.ignored, f.key])] }))

  return (
    <div className="flex flex-col gap-4">
      <StatsCard stats={stats} />

      {notice ? <p className="text-xs text-destructive">{notice}</p> : null}

      <div className="flex flex-col gap-2">
        {STYLE_RULE_IDS.map((rule) => (
          <RuleGroup
            key={rule}
            rule={rule}
            enabled={settings.rules[rule]}
            findings={findings.filter((f) => f.rule === rule)}
            extra={rule === "adverb" ? `${stats.adverbsPer100} per 100 words` : undefined}
            onToggle={(on) => change((s) => ({ ...s, rules: { ...s.rules, [rule]: on } }))}
            onGo={goTo}
            onIgnore={ignore}
          />
        ))}
      </div>

      <StyleSettingsForm settings={settings} onChange={change} />
    </div>
  )
}

function StatsCard({ stats }: { stats: ChapterStats }) {
  const dialoguePct = Math.round(stats.dialogueShare * 100)
  const top = stats.speakers.slice(0, 6)
  const rest = stats.speakers.slice(6).reduce((n, s) => n + s.words, 0)
  const dialogueRows = [...top, ...(rest ? [{ id: "_rest", name: "Others", words: rest }] : [])]
  if (stats.unattributedWords) dialogueRows.push({ id: "_none", name: "Not sure who", words: stats.unattributedWords })

  return (
    <section className="rounded-md bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground">
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        <Stat label="Words" value={stats.words.toLocaleString()} />
        <Stat label="Reading time" value={stats.readingMinutes ? `${stats.readingMinutes} min` : "—"} />
        <Stat label="Sentences" value={stats.sentences.toLocaleString()} />
        <Stat label="Avg. sentence" value={`${stats.avgSentenceWords} words`} />
      </dl>

      <p className="mt-3 mb-1 flex justify-between">
        <span>Dialogue / narration</span>
        <span className="text-foreground">
          {dialoguePct}% / {100 - dialoguePct}%
        </span>
      </p>
      <div className="h-1.5 overflow-hidden rounded-full bg-border" role="img" aria-label={`${dialoguePct}% dialogue, ${100 - dialoguePct}% narration`}>
        <div className="h-full bg-primary" style={{ width: `${dialoguePct}%` }} />
      </div>

      {stats.dialogueWords > 0 ? (
        <>
          <p className="mt-3 mb-1.5">Who speaks</p>
          <ul className="flex flex-col gap-1">
            {dialogueRows.map((s) => {
              const pct = Math.round((s.words / stats.dialogueWords) * 100)
              return (
                <li key={s.id} className="flex items-center gap-2">
                  <span className={cn("w-24 truncate", s.id.startsWith("_") ? "italic" : "text-foreground")}>{s.name}</span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-border">
                    <span className="block h-full bg-primary/70" style={{ width: `${pct}%` }} />
                  </span>
                  <span className="w-8 text-right tabular-nums">{pct}%</span>
                </li>
              )
            })}
          </ul>
          <p className="mt-1.5 text-[11px]">
            A best guess from dialogue tags (“said Mara”) and names near each line.
          </p>
        </>
      ) : null}
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px]">{label}</dt>
      <dd className="text-sm text-foreground tabular-nums">{value}</dd>
    </div>
  )
}

function RuleGroup({
  rule,
  enabled,
  findings,
  extra,
  onToggle,
  onGo,
  onIgnore,
}: {
  rule: StyleRuleId
  enabled: boolean
  findings: StyleFinding[]
  extra?: string
  onToggle: (on: boolean) => void
  onGo: (f: StyleFinding) => void
  onIgnore: (f: StyleFinding) => void
}) {
  const [open, setOpen] = useState(false)
  const [all, setAll] = useState(false)
  const info = STYLE_RULES[rule]
  const shown = all ? findings : findings.slice(0, PREVIEW)

  return (
    <section className="rounded-md border border-border">
      <div className="flex items-center gap-2 px-2.5 py-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          disabled={!enabled || findings.length === 0}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-sm text-foreground disabled:cursor-default"
          title={info.description}
        >
          {enabled && findings.length > 0 ? (
            open ? <CaretDownIcon className="size-3 shrink-0" /> : <CaretRightIcon className="size-3 shrink-0" />
          ) : (
            <span className="size-3 shrink-0" />
          )}
          <span className={cn("size-2 shrink-0 rounded-full", `${info.color}-dot`)} aria-hidden />
          <span className={cn("truncate", !enabled && "text-muted-foreground")}>{info.label}</span>
          {enabled ? <span className="text-xs text-muted-foreground tabular-nums">{findings.length}</span> : null}
        </button>
        <label className="flex items-center" title={enabled ? `Turn off ${info.label.toLowerCase()}` : `Turn on ${info.label.toLowerCase()}`}>
          <input type="checkbox" checked={enabled} onChange={(e) => onToggle(e.target.checked)} className="size-3.5 accent-primary" />
          <span className="sr-only">{info.label}</span>
        </label>
      </div>
      {enabled && extra ? <p className="-mt-1 px-2.5 pb-2 pl-[2.1rem] text-[11px] text-muted-foreground">{extra}</p> : null}

      {open && enabled && findings.length > 0 ? (
        <ul className="flex flex-col gap-1.5 border-t border-border px-2.5 py-2">
          {shown.map((f) => (
            <li key={`${f.key}:${f.start}`} className="text-xs">
              <p className="line-clamp-2 text-foreground">{f.rule === "long-sentence" ? f.quote : f.message}</p>
              {f.rule === "long-sentence" ? <p className="text-muted-foreground">{f.message}</p> : null}
              <div className="mt-0.5 flex gap-3">
                <button type="button" onClick={() => onGo(f)} className="text-[11px] font-medium text-primary hover:underline">
                  Go to text
                </button>
                <button type="button" onClick={() => onIgnore(f)} className="text-[11px] font-medium text-muted-foreground hover:text-foreground">
                  Ignore
                </button>
              </div>
            </li>
          ))}
          {findings.length > PREVIEW ? (
            <li>
              <button type="button" onClick={() => setAll((v) => !v)} className="text-[11px] font-medium text-primary hover:underline">
                {all ? "Show fewer" : `Show all ${findings.length}`}
              </button>
            </li>
          ) : null}
        </ul>
      ) : null}
    </section>
  )
}

function StyleSettingsForm({ settings, onChange }: { settings: StyleSettings; onChange: (fn: (s: StyleSettings) => StyleSettings) => void }) {
  const [fillerDraft, setFillerDraft] = useState<string | null>(null)
  const fillerText = fillerDraft ?? settings.fillerWords.join(", ")
  const saveFiller = () => {
    if (fillerDraft === null) return
    const words = [...new Set(fillerDraft.split(/[,\n]/).map((w) => w.trim().toLowerCase()).filter(Boolean))].slice(0, 200)
    onChange((s) => ({ ...s, fillerWords: words }))
    setFillerDraft(null)
  }

  return (
    <section className="flex flex-col gap-2.5 border-t border-border pt-3 text-xs text-muted-foreground">
      <label className="flex items-center justify-between gap-2">
        Underline in the text
        <input
          type="checkbox"
          checked={settings.highlights}
          onChange={(e) => {
            // Read it now: the updater runs later, after React has reset the box.
            const on = e.target.checked
            onChange((s) => ({ ...s, highlights: on }))
          }}
          className="size-3.5 accent-primary"
        />
      </label>
      <NumberSetting
        label="Long sentence: more than"
        value={settings.maxSentenceWords}
        min={10}
        max={200}
        onCommit={(n) => onChange((s) => ({ ...s, maxSentenceWords: n }))}
      />
      <NumberSetting
        label="Repeated word: within"
        value={settings.repeatWindow}
        min={5}
        max={200}
        onCommit={(n) => onChange((s) => ({ ...s, repeatWindow: n }))}
      />
      <div className="flex flex-col gap-1">
        <span className="flex items-center justify-between">
          <label htmlFor="style-filler-words">Filler words, separated by commas</label>
          <button
            type="button"
            onClick={() => {
              setFillerDraft(null)
              onChange((s) => ({ ...s, fillerWords: DEFAULT_FILLER_WORDS }))
            }}
            className="font-medium text-primary hover:underline"
          >
            Reset list
          </button>
        </span>
        <textarea
          id="style-filler-words"
          value={fillerText}
          onChange={(e) => setFillerDraft(e.target.value)}
          onBlur={saveFiller}
          rows={3}
          className="resize-y rounded border border-border bg-transparent px-1.5 py-1 text-foreground"
        />
      </div>
      {settings.ignored.length > 0 ? (
        <p className="flex items-center justify-between">
          {settings.ignored.length} ignored
          <button type="button" onClick={() => onChange((s) => ({ ...s, ignored: [] }))} className="font-medium text-primary hover:underline">
            Show them again
          </button>
        </p>
      ) : null}
    </section>
  )
}

/**
 * A number of words, typed freely and saved on blur or Enter (clamping on
 * every keystroke would turn "45" into "10" before the 5 is typed).
 */
function NumberSetting({
  label,
  value,
  min,
  max,
  onCommit,
}: {
  label: string
  value: number
  min: number
  max: number
  onCommit: (n: number) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const commit = () => {
    if (draft === null) return
    const n = Math.round(Number(draft))
    if (Number.isFinite(n) && draft.trim() !== "") {
      const clamped = Math.min(max, Math.max(min, n))
      if (clamped !== value) onCommit(clamped)
    }
    setDraft(null)
  }
  return (
    <label className="flex items-center justify-between gap-2">
      {label}
      <span className="flex items-center gap-1">
        <input
          type="number"
          min={min}
          max={max}
          value={draft ?? value}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit()
          }}
          className="w-12 rounded border border-border bg-transparent px-1 py-0.5 text-right text-foreground"
        />
        words
      </span>
    </label>
  )
}
