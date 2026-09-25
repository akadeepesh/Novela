# KoraKagaj

A calmer place to write your book — a focused workspace for novels, poetry,
short story collections, scripts, and everything in between. Manuscript,
characters, world, plot, notes, and research all live in one quiet place,
linked together instead of scattered across files.

## Why

Most writing tools are either too simple (a folder of docs, no structure)
or too complex (full production-software energy that takes a manual to
learn). KoraKagaj sits in between: real structure when a project needs it,
invisible when it doesn't — and every project type gets its own shape
rather than one generic template stretched over everything.

## Features

- **A real writing surface** — a Tiptap-based manuscript editor with
  autosave, focus/typewriter mode, and per-project customizable page
  appearance (background, header, footer, font size, line height).
- **Story Bible** — Characters, World, and Plot sections, cross-linked by
  an `@mention` system so referencing a character or place from your prose
  quietly keeps a backlink index, without ever writing for you.
- **Notes & Research** — a Keep-style scratchpad for notes, and a source
  board for research: paste a URL and it's auto-fetched into a bookmark
  card (title, image, favicon), with a manual quick-note fallback for
  offline sources.
- **Per-type project ecosystems** — Novel, Poetry, Script, and Custom
  projects each get their own sidebar, defaults, and visual theme rather
  than a one-size-fits-all shape.
- **Book Settings** — front/back cover art, a back-cover blurb, chapter
  numbering styles, and export trim size; leave the cover blank and a
  clean typeset cover is generated from the title and author instead.
- **Export** — PDF, EPUB, and DOCX, built from the same document model so
  what you see in the editor is what ships.
- **Auth** — email/password and Google OAuth, via Auth.js (NextAuth v5).

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router) + TypeScript |
| Database | MongoDB via Mongoose |
| Auth | Auth.js (NextAuth v5) — credentials + Google OAuth |
| File storage | Vercel Blob (cover art, custom manuscript backgrounds) |
| Editor | Tiptap |
| UI | Base UI primitives + Tailwind CSS v4, Phosphor icons |
| Export | `@react-pdf/renderer` (PDF), `docx` (DOCX), `jszip` (EPUB) |
