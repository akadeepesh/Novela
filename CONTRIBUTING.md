# Contributing

Thanks for helping. This is a free, private writing app, and a few rules keep it that way. Please read
them before you open a pull request.

## The rules that don't bend

1. **No AI.** Nothing in the app writes, rewrites or summarises for the writer, and no text is sent to an
   AI service. Story Check and the style checks are plain rules that run on the device.
2. **No network calls with the writer's content.** Books live in the browser (IndexedDB) and never go to
   a server. The only exception is the Research link preview, which sends the pasted URL and nothing else.
   A new feature that needs a server for user content won't be merged.
3. **No accounts and no locked features.** Everything in the app is free. Paid template packs are
   separate files, never committed here.
4. **Never lose a writer's work.** Any change to stored data needs a migration and must keep backups
   working (see below).

## Getting started

You need Node.js 20.9 or newer.

```bash
npm install
npm run dev        # http://localhost:3000
```

This project uses a recent Next.js with breaking changes from older versions. Before writing
Next-specific code, read the matching guide in `node_modules/next/dist/docs/` (see `AGENTS.md`).

## Before you send a pull request

Run all four. A pull request should pass every one.

```bash
npm run typecheck
npm run lint
npm test           # Vitest, against an in-memory IndexedDB
npm run build
```

On Windows, `npm test` goes through `scripts/vitest.mjs`, which works around a drive-letter casing
problem. Use it rather than calling `vitest` directly.

## How the code is laid out

- `app/` – routes. `app/(marketing)/` holds the public pages (landing, guides, legal); everything else
  is the writing app.
- `lib/store/` – the local database (`db.ts`), one file of functions per table, and live React hooks
  (`hooks.ts`).
- `lib/backup/` – project files and full backups.
- `lib/story-check/` and `lib/style-check/` – the checks, as pure functions with fixture tests.
- `lib/print/` – the print PDF, covers and template packs. The template format is in `templates/spec.md`.
- `components/` – UI, with the editor's Tiptap extensions in `components/editor/`.

## Changing stored data

- Add a new entry to `migrations` in `lib/store/db.ts` with the next version number, and bump
  `SCHEMA_VERSION`. Never edit an entry that has shipped.
- If the new data belongs to a book, add its table to `CHILD_TABLES` in `lib/backup/format.ts`, to the
  delete in `lib/store/projects.ts`, and to the backup round-trip test. Make sure files from older
  versions still import.

## Writing for the interface

Write UI text in plain, short English for writers, not developers: say what happened and what to do
next. Avoid jargon such as "IndexedDB" or "schema" in anything a writer sees.

## Fonts, images and templates

Anything bundled must be free to redistribute (for fonts, the SIL Open Font License or similar). Put the
licence file next to the asset. Community templates are welcome: see `templates/spec.md`.

## Tests

Add tests for logic: rules, storage, backups, print geometry. Story Check and style rules should come
with fixture text that shows both a catch and a near-miss that must not be flagged.

## Licence

By contributing, you agree that your contribution is licensed under the
[GNU Affero General Public License v3.0](LICENSE), the same licence as the project.
