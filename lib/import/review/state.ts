/**
 * The review screen's state and the only ways it changes. A pure reducer, so
 * undo/redo is just keeping earlier states, and so the rules (what a merge
 * does to a title, what a split does to confidence) live in one place.
 */
import { titleFromFirstLine } from "@/lib/import/structure/segment";
import { countWords, firstLines, mergeDocs, splitDoc, type SplitPoint } from "./doc-ops";
import type { BackgroundChoice, ReviewPiece, ReviewState } from "./types";

export type ReviewAction =
  | { type: "rename"; id: string; title: string }
  | { type: "merge"; id: string } // with the piece after it
  | { type: "split"; id: string; at: SplitPoint }
  | { type: "remove"; id: string }
  | { type: "move"; id: string; to: number }
  | { type: "reorder"; ids: string[] }
  | { type: "check"; id: string; checked: boolean }
  | { type: "background"; choice: BackgroundChoice }
  | { type: "cover"; use: boolean }
  | { type: "bookTitle"; title: string };

const MAX_TITLE = 200;

export function reviewReducer(state: ReviewState, action: ReviewAction): ReviewState {
  const index = "id" in action ? state.pieces.findIndex((p) => p.id === action.id) : -1;
  const piece = index >= 0 ? state.pieces[index] : undefined;
  const replace = (next: ReviewPiece[]): ReviewState => ({ ...state, pieces: next });

  switch (action.type) {
    case "rename": {
      const title = action.title.replace(/\s+/g, " ").trim().slice(0, MAX_TITLE);
      if (!piece || !title || title === piece.title) return state;
      return replace(state.pieces.map((p) => (p.id === piece.id ? { ...p, title, titleSource: "edited" } : p)));
    }

    case "merge": {
      const next = state.pieces[index + 1];
      if (!piece || !next) return state;
      const doc = mergeDocs(piece.doc, next.doc);
      const merged: ReviewPiece = {
        ...piece,
        doc,
        wordCount: countWords(doc),
        startPage: Math.min(piece.startPage, next.startPage),
        endPage: Math.max(piece.endPage, next.endPage),
        confidence: "high",
        flags: [],
        checked: true,
      };
      return replace([...state.pieces.slice(0, index), merged, ...state.pieces.slice(index + 2)]);
    }

    case "split": {
      if (!piece) return state;
      const halves = splitDoc(piece.doc, action.at);
      if (!halves) return state;
      const [a, b] = halves;
      const firstB = firstLines(b, 1)[0];
      const seq = state.seq + 1;
      const first: ReviewPiece = { ...piece, doc: a, wordCount: countWords(a), confidence: "high", flags: [], checked: true };
      const second: ReviewPiece = {
        ...piece,
        id: `n${seq}`,
        doc: b,
        wordCount: countWords(b),
        title: firstB ? titleFromFirstLine(firstB) : `${piece.title} (continued)`,
        titleSource: firstB ? "first-line" : "edited",
        confidence: "high",
        flags: [],
        checked: true,
      };
      return { ...replace([...state.pieces.slice(0, index), first, second, ...state.pieces.slice(index + 1)]), seq };
    }

    case "remove": {
      if (!piece || state.pieces.length <= 1) return state;
      return replace(state.pieces.filter((p) => p.id !== piece.id));
    }

    case "move": {
      if (!piece) return state;
      const to = Math.max(0, Math.min(state.pieces.length - 1, action.to));
      if (to === index) return state;
      const next = state.pieces.slice();
      next.splice(index, 1);
      next.splice(to, 0, piece);
      return replace(next);
    }

    case "reorder": {
      const byId = new Map(state.pieces.map((p) => [p.id, p]));
      const next = action.ids.map((id) => byId.get(id)).filter((p): p is ReviewPiece => !!p);
      if (next.length !== state.pieces.length) return state;
      return next.every((p, i) => p === state.pieces[i]) ? state : replace(next);
    }

    case "check":
      if (!piece || piece.checked === action.checked) return state;
      return replace(state.pieces.map((p) => (p.id === piece.id ? { ...p, checked: action.checked } : p)));

    case "background":
      return JSON.stringify(state.background) === JSON.stringify(action.choice) ? state : { ...state, background: action.choice };

    case "cover":
      return state.useCover === action.use ? state : { ...state, useCover: action.use };

    case "bookTitle": {
      const title = action.title.replace(/\s+/g, " ").trim().slice(0, MAX_TITLE);
      return title && title !== state.bookTitle ? { ...state, bookTitle: title } : state;
    }
  }
}

/** Undo / redo as plain history over states. */
export type History = { past: ReviewState[]; present: ReviewState; future: ReviewState[] };
const HISTORY_LIMIT = 100;

export const startHistory = (present: ReviewState): History => ({ past: [], present, future: [] });

export function applyAction(h: History, action: ReviewAction): History {
  const next = reviewReducer(h.present, action);
  if (next === h.present) return h;
  return { past: [...h.past.slice(-(HISTORY_LIMIT - 1)), h.present], present: next, future: [] };
}
export const undo = (h: History): History =>
  h.past.length ? { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] } : h;
export const redo = (h: History): History =>
  h.future.length ? { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) } : h;
