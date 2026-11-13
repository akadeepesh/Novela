# Launch checklist

Known gaps, placeholders and follow-ups that must be resolved (or consciously
accepted) before the public launch. Each item says where it lives and what
"done" means. Tick items off in the PR that fixes them.

## Must fix before launch

### Brand and naming (blocked on choosing the final name)
- [ ] **App name, tagline, domain**: `APP_NAME`, `TAGLINE`, `DOMAIN` and `DESCRIPTION` in `lib/brand.ts`
  are placeholders. Done when they hold the final name and the UI, metadata,
  manifest and URL-preview user agent all show it.
- [ ] **File extension**: `BACKUP_FILE_EXTENSION` in `lib/brand.ts` (`korakagaj`). Done when it is the
  final extension. Importing must keep accepting `.korakagaj` files made
  before the rename, plus `.zip`.
- [ ] **Database name**: `DB_NAME` in `lib/store/db.ts` (`korakagaj`). **Do not just rename it.** A new
  name opens an empty database, and every writer would appear to lose their
  books. Either keep the old internal name forever (it is never shown), or add
  a one-time copy from the old database at startup. Decide before launch.
- [ ] **Backup format id**: `BACKUP_FORMAT` in `lib/backup/format.ts` (`korakagaj-backup`). It is
  internal, but if it is changed, `readBackup` must still accept the old id.
- [ ] **Icons and images**: the favicon, apple icon, Android icons, OpenGraph and Twitter images
  (`app/*.png`, `public/android-chrome-*`) show the old brand. Replace them
  with the final logo.
- [ ] **Leftover starter files**: `public/file.svg`, `globe.svg`, `next.svg`, `vercel.svg` and
  `window.svg` are unused create-next-app files. Delete them.

### Privacy promise
- [ ] **Research link previews must be opt-in**: today, pasting a link sends that URL to
  our server (`app/actions/url-preview.ts`) to fetch a title and image. The
  plan says this must be opt-in. Done when it is off by default, a setting
  turns it on, and with it off a pasted link becomes a plain card with no
  network call.

### Verify in a real browser
- [ ] **PDF export**: in Phase 1 the renderer moved to the browser
  (`lib/export/render-pdf.tsx`, `pdf().toBlob()`). EPUB and DOCX are tested
  in Node, but PDF can't be (a `@react-pdf` module-resolution limitation).
  Done when a PDF exports correctly in Chrome, Firefox and Safari, ideally
  covered by a Playwright test.
- [ ] **Folder backup**: test in Chrome and Edge (choose the folder, write, prune
  after seven days, reconnect after a restart).
- [ ] **Restore after clearing site data**: test by hand in each major browser.

## Should fix before launch

- [ ] **Offline for pages never opened**: the service worker (`public/sw.js`) serves
  only pages opened before. A fresh install that goes offline straight away
  can open the dashboard but not a book. Options: precache a route shell per
  section and serve it for any `[id]`, or move to a static export with
  client-side routing. Done when any book opens offline after one online
  visit to the dashboard.
- [ ] **Backups beyond one browser**: data lives in one browser. Folder backup
  covers Chromium only. Safari and Firefox users depend on manual
  downloads and the reminder. Consider the optional Google Drive backup from
  the plan (client-side OAuth, app-data folder) or a desktop app (Tauri,
  Phase 7).
- [ ] **Legal pages**: privacy policy and terms (needed for the store and analytics
  in Phases 5 and 6). The privacy policy should state that content never
  leaves the device.

## Clean-up (no user impact)

- [ ] **Dead components**: `components/ui/create-button.tsx` (it still mentions the removed
  `safeAction`) and `components/project/section-coming-soon.tsx` are unused.
  Delete them.
- [ ] **Unused project fields**: `dailyWordGoal` and `targetWordCount` are stored but
  unused. Use them for the Phase 4 session goals, or drop them in a schema
  migration.

## Deliberately deferred (tracked in the plan)

- Beta-reader sharing returns in Phase 7 as an exported reader file.
- The landing page and SEO pages are Phase 6.
