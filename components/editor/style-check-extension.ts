import { Extension } from "@tiptap/core"
import { Plugin, PluginKey, TextSelection, type EditorState } from "@tiptap/pm/state"
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view"
import type { Node as PMNode } from "@tiptap/pm/model"
import { quoteRanges, type Block, type MentionRef } from "@/lib/story-check/text"
import { analyzeStyle, chapterStats } from "@/lib/style-check/rules"
import { DEFAULT_STYLE_SETTINGS, STYLE_RULES, type ChapterStats, type StyleCharacter, type StyleFinding, type StyleSettings } from "@/lib/style-check/types"

/** Wait this long after the last keystroke before checking again. */
const DEBOUNCE_MS = 500

export type StyleCheckConfig = {
  /** Run the checks at all (the panel is open, or highlights are on). */
  active: boolean
  settings: StyleSettings
  characters: StyleCharacter[]
  /** Extra names never flagged as repeats (places). */
  names: string[]
}

export type StyleCheckState = {
  config: StyleCheckConfig
  findings: StyleFinding[]
  stats: ChapterStats | null
  /** One inline range per finding (spec.key), mapped through every edit. */
  ranges: DecorationSet
}

export const styleCheckKey = new PluginKey<StyleCheckState>("styleCheck")

type Meta =
  | { type: "config"; config: StyleCheckConfig }
  | { type: "results"; findings: StyleFinding[]; stats: ChapterStats; ranges: DecorationSet }

const INITIAL_CONFIG: StyleCheckConfig = { active: false, settings: DEFAULT_STYLE_SETTINGS, characters: [], names: [] }

/**
 * The chapter's textblocks as Story Check and the style rules see them
 * (an @mention counts as its label), with the document position of every
 * character so a finding's offsets can be turned back into positions.
 */
export function docBlocks(doc: PMNode): { block: Block; map: number[] }[] {
  const out: { block: Block; map: number[] }[] = []
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true
    let text = ""
    const map: number[] = []
    const mentions: MentionRef[] = []
    let offset = pos + 1
    node.forEach((child) => {
      if (child.isText) {
        for (let i = 0; i < child.text!.length; i++) map.push(offset + i)
        text += child.text
      } else {
        const isMention = child.type.name === "mention"
        const label = isMention ? String(child.attrs.label ?? "") : child.type.name === "hardBreak" ? "\n" : " "
        if (isMention && child.attrs.id) {
          mentions.push({ id: String(child.attrs.id), entityType: String(child.attrs.entityType ?? ""), start: text.length, end: text.length + label.length })
        }
        for (let i = 0; i < label.length; i++) map.push(offset)
        text += label
      }
      offset += child.nodeSize
    })
    out.push({ block: { index: out.length, text, mentions, quotes: quoteRanges(text) }, map })
    return false
  })
  return out
}

function analyze(doc: PMNode, config: StyleCheckConfig): Extract<Meta, { type: "results" }> {
  const blocks = docBlocks(doc)
  const plain = blocks.map((b) => b.block)
  const names = [...config.names, ...config.characters.flatMap((c) => [c.name, ...c.aliases])]
  const findings = analyzeStyle(plain, { settings: config.settings, names })
  const stats = chapterStats(plain, config.characters)
  const decos: Decoration[] = []
  for (const f of findings) {
    const map = blocks[f.blockIndex]?.map
    if (!map || f.end <= f.start || map[f.start] === undefined || map[f.end - 1] === undefined) continue
    decos.push(
      Decoration.inline(map[f.start], map[f.end - 1] + 1, { class: `style-mark ${STYLE_RULES[f.rule].color}` }, { key: f.key, rule: f.rule })
    )
  }
  return { type: "results", findings, stats, ranges: DecorationSet.create(doc, decos) }
}

export function getStyleCheckState(state: EditorState): StyleCheckState | undefined {
  return styleCheckKey.getState(state)
}

/** Selects and scrolls to a finding, wherever its text has moved since. False if it's gone. */
export function revealFinding(view: EditorView, key: string): boolean {
  const s = styleCheckKey.getState(view.state)
  const found = s?.ranges.find(undefined, undefined, (spec) => spec.key === key)[0]
  if (!found) return false
  try {
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, found.from, found.to)).scrollIntoView())
    view.focus()
    return true
  } catch {
    return false
  }
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    styleCheck: {
      configureStyleCheck: (config: StyleCheckConfig) => ReturnType
    }
  }
}

/**
 * Style checks on the live chapter text: findings and stats in plugin
 * state for the Style tab, and optional underlines in the text. Runs on the
 * main thread, debounced; one chapter takes a few milliseconds.
 */
export const StyleCheck = Extension.create({
  name: "styleCheck",

  addProseMirrorPlugins() {
    return [
      new Plugin<StyleCheckState>({
        key: styleCheckKey,
        state: {
          init: (_, { doc }) => ({ config: INITIAL_CONFIG, findings: [], stats: null, ranges: DecorationSet.create(doc, []) }),
          apply(tr, prev) {
            const meta = tr.getMeta(styleCheckKey) as Meta | undefined
            if (meta?.type === "config") return { ...prev, config: meta.config }
            if (meta?.type === "results") return { ...prev, findings: meta.findings, stats: meta.stats, ranges: meta.ranges }
            if (tr.docChanged) return { ...prev, ranges: prev.ranges.map(tr.mapping, tr.doc) }
            return prev
          },
        },
        props: {
          decorations(state) {
            const s = styleCheckKey.getState(state)
            return s?.config.active && s.config.settings.highlights ? s.ranges : null
          },
        },
        view(view) {
          let timer: ReturnType<typeof setTimeout> | null = null
          const schedule = (delay: number) => {
            if (timer) clearTimeout(timer)
            timer = setTimeout(() => {
              timer = null
              const s = styleCheckKey.getState(view.state)
              if (!s?.config.active || view.isDestroyed) return
              const tr = view.state.tr.setMeta(styleCheckKey, analyze(view.state.doc, s.config)).setMeta("addToHistory", false)
              view.dispatch(tr)
            }, delay)
          }
          return {
            update(view, prevState) {
              const s = styleCheckKey.getState(view.state)
              const prev = styleCheckKey.getState(prevState)
              if (!s?.config.active) return
              if (s.config !== prev?.config) schedule(30)
              else if (view.state.doc !== prevState.doc) schedule(DEBOUNCE_MS)
            },
            destroy() {
              if (timer) clearTimeout(timer)
            },
          }
        },
      }),
    ]
  },

  addCommands() {
    return {
      configureStyleCheck:
        (config) =>
        ({ tr, dispatch }) => {
          if (dispatch) dispatch(tr.setMeta(styleCheckKey, { type: "config", config } satisfies Meta).setMeta("addToHistory", false))
          return true
        },
    }
  },
})
