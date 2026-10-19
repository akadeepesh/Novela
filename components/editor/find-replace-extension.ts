import { Extension } from "@tiptap/core"
import { Plugin, PluginKey, TextSelection, type EditorState, type Transaction } from "@tiptap/pm/state"
import { Decoration, DecorationSet } from "@tiptap/pm/view"
import type { Node as PMNode } from "@tiptap/pm/model"

export type SearchOptions = { caseSensitive: boolean; wholeWord: boolean }
type Match = { from: number; to: number }

export type FindReplaceState = {
  query: string
  options: SearchOptions
  matches: Match[]
  /** Index into `matches` of the highlighted one, or -1. */
  current: number
  decorations: DecorationSet
}

export const findReplaceKey = new PluginKey<FindReplaceState>("findReplace")

type Meta =
  | { type: "search"; query: string; options: SearchOptions }
  | { type: "goto"; index: number }

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * Every match of `query` in the document. Searches one textblock at a time,
 * across the text nodes inside it, so a phrase that spans bold and plain
 * text is still found. Inline non-text nodes (@-mentions, line breaks) take
 * one position each, matching ProseMirror's own position counting.
 */
function findMatches(doc: PMNode, query: string, options: SearchOptions): Match[] {
  if (!query) return []
  const flags = options.caseSensitive ? "g" : "gi"
  const source = options.wholeWord ? `(?<![\\p{L}\\p{N}_])${escapeRegExp(query)}(?![\\p{L}\\p{N}_])` : escapeRegExp(query)
  const re = new RegExp(source, flags + "u")
  const matches: Match[] = []

  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true
    let text = ""
    node.forEach((child) => {
      text += child.isText ? child.text! : "￼".repeat(child.nodeSize)
    })
    const start = pos + 1
    for (const m of text.matchAll(re)) {
      if (m[0].length === 0) continue
      matches.push({ from: start + m.index!, to: start + m.index! + m[0].length })
    }
    return false
  })
  return matches
}

function build(doc: PMNode, query: string, options: SearchOptions, current: number): FindReplaceState {
  const matches = findMatches(doc, query, options)
  const index = matches.length === 0 ? -1 : Math.min(Math.max(current, 0), matches.length - 1)
  const decorations = DecorationSet.create(
    doc,
    matches.map((m, i) =>
      Decoration.inline(m.from, m.to, { class: i === index ? "search-match search-match-current" : "search-match" })
    )
  )
  return { query, options, matches, current: index, decorations }
}

const EMPTY_OPTIONS: SearchOptions = { caseSensitive: false, wholeWord: false }

export function getFindReplaceState(state: EditorState): FindReplaceState | undefined {
  return findReplaceKey.getState(state)
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    findReplace: {
      setSearch: (query: string, options: SearchOptions) => ReturnType
      gotoMatch: (direction: 1 | -1) => ReturnType
      replaceCurrent: (replacement: string) => ReturnType
      replaceAll: (replacement: string) => ReturnType
      clearSearch: () => ReturnType
    }
  }
}

function selectMatch(tr: Transaction, match: Match | undefined) {
  if (!match) return tr
  return tr.setSelection(TextSelection.create(tr.doc, match.from, match.to)).scrollIntoView()
}

/** Find & replace inside the chapter, with highlighted matches. */
export const FindReplace = Extension.create({
  name: "findReplace",

  addProseMirrorPlugins() {
    return [
      new Plugin<FindReplaceState>({
        key: findReplaceKey,
        state: {
          init: (_, { doc }) => build(doc, "", EMPTY_OPTIONS, -1),
          apply(tr, prev) {
            const meta = tr.getMeta(findReplaceKey) as Meta | undefined
            if (meta?.type === "search") return build(tr.doc, meta.query, meta.options, 0)
            if (meta?.type === "goto") return build(tr.doc, prev.query, prev.options, meta.index)
            if (tr.docChanged && prev.query) return build(tr.doc, prev.query, prev.options, prev.current)
            return prev
          },
        },
        props: {
          decorations: (state) => findReplaceKey.getState(state)?.decorations,
        },
      }),
    ]
  },

  addCommands() {
    return {
      setSearch:
        (query, options) =>
        ({ tr, dispatch }) => {
          if (dispatch) dispatch(tr.setMeta(findReplaceKey, { type: "search", query, options } satisfies Meta))
          return true
        },
      clearSearch:
        () =>
        ({ tr, dispatch }) => {
          if (dispatch) dispatch(tr.setMeta(findReplaceKey, { type: "search", query: "", options: EMPTY_OPTIONS } satisfies Meta))
          return true
        },
      gotoMatch:
        (direction) =>
        ({ state, tr, dispatch }) => {
          const s = findReplaceKey.getState(state)
          if (!s || s.matches.length === 0) return false
          const index = (s.current + direction + s.matches.length) % s.matches.length
          if (dispatch) dispatch(selectMatch(tr.setMeta(findReplaceKey, { type: "goto", index } satisfies Meta), s.matches[index]))
          return true
        },
      replaceCurrent:
        (replacement) =>
        ({ state, tr, dispatch }) => {
          const s = findReplaceKey.getState(state)
          const match = s?.matches[s.current]
          if (!s || !match) return false
          if (dispatch) {
            if (replacement) tr.insertText(replacement, match.from, match.to)
            else tr.delete(match.from, match.to)
            // Stay on the same index: it now points at the next match.
            tr.setMeta(findReplaceKey, { type: "goto", index: s.current } satisfies Meta)
            dispatch(tr)
          }
          return true
        },
      replaceAll:
        (replacement) =>
        ({ state, tr, dispatch }) => {
          const s = findReplaceKey.getState(state)
          if (!s || s.matches.length === 0) return false
          if (dispatch) {
            // Back to front, so earlier positions stay valid. One transaction:
            // a single Undo puts everything back.
            for (const m of [...s.matches].reverse()) {
              if (replacement) tr.insertText(replacement, m.from, m.to)
              else tr.delete(m.from, m.to)
            }
            dispatch(tr)
          }
          return true
        },
    }
  },
})
