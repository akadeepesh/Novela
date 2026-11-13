# Launch checklist

Known gaps, placeholders and follow-ups that must be resolved (or consciously
accepted) before the public launch. Each item says where it lives and what
"done" means. Tick items off in the PR that fixes them.

## Must fix before launch

### Brand and naming
- [x] **App name and domain**: the app is **Novela**, at `novela.akadeepesh.com` (`lib/brand.ts`).
  The UI, metadata, manifest and link-preview user agent read from there.
- [x] **File extension**: `.novela`. Importing still accepts `.korakagaj` files from before the
  rename, plus `.zip`.
- [x] **Database name**: kept as `korakagaj` on purpose (`DB_NAME` in `lib/store/db.ts`). It's never
  shown, and renaming it would hide every book already written.
- [x] **Backup and template format ids**: now `novela-backup`, `novela-template` and
  `novela-template-pack`. The old `korakagaj-*` ids are still read, with tests.
- [ ] **Domain live**: point `novela.akadeepesh.com` at the Vercel project (a CNAME on
  akadeepesh.com) and add it as the project's domain in Vercel. Production builds already use it
  for canonical links, the sitemap and robots.txt.
- [x] **Social preview image**: `app/opengraph-image.png` and `app/twitter-image.png` (1200×630) show
  Novela and the new headline, with alt text. The full-size source is `docs/brand/social-preview-source.png`.
- [ ] **Logo and icons**: the favicon (`app/favicon.ico`), `app/icon.png`, `app/apple-icon.png` and
  `public/android-chrome-*` still show the old "K" logo. Replace them with the Novela mark.
- [x] **Leftover starter files**: the unused create-next-app SVGs in `public/` are deleted.

### Going public (Phase 6, needs the owner)
- [ ] **Open the repo**: the GitHub repo is private. Done when it is public, `REPO_URL` in
  `lib/brand.ts` is set (this shows the "Source code" links), and the README screenshots render on
  GitHub. Check the history has no secrets first (`.env` is ignored, but look).
- [ ] **Privacy contact**: `CONTACT_EMAIL` in `lib/brand.ts` is empty, so the privacy page has no
  contact line. Set an address that is checked.
- [ ] **Analytics**: turn on Web Analytics for the project in the Vercel dashboard. The app already
  includes `@vercel/analytics` on the public pages only (never in the writing app, which a test
  checks), and the privacy page describes it.
- [ ] **Search engines**: after deploying, submit the sitemap in Google Search Console and Bing
  Webmaster Tools, and check that the four guide pages are indexed.
- [ ] **Comparison facts**: the landing page table (`lib/marketing/comparison.ts`) was checked on
  14 November 2026. Campfire's AI features couldn't be confirmed, so that cell says "Not confirmed".
  Re-check every claim before posting, and update `COMPARISON_CHECKED`.
- [ ] **Legal review**: `/privacy` and `/terms` are plain-English drafts written to match what the app
  does. Have them read by someone qualified before the store opens, especially the liability wording
  and anything your country requires (for example, a named data controller under GDPR).
- [ ] **Launch posts**: drafts are in `docs/launch-posts.md` (Show HN, Product Hunt, Reddit, a short
  video script). Read each subreddit's self-promotion rules first. Record the video from the real app.
- [ ] **Lighthouse on the public pages**: run Lighthouse on `/` and one guide page in production and
  fix anything under 90 for performance, accessibility and SEO. The demo animation respects reduced
  motion; check it on a slow phone.

### Template store (blocked on opening the store)
- [ ] **Store link**: `TEMPLATE_STORE_URL` in `lib/brand.ts` is empty, so the More templates page says
  "opening soon". Done when the Lemon Squeezy or Gumroad store exists, the URL is set, and at least
  one paid pack is for sale. Paid pack files must never be committed to this repo.

### Privacy promise
- [ ] **Research link previews must be opt-in**: today, pasting a link sends that URL to
  our server (`app/actions/url-preview.ts`) to fetch a title and image. The
  plan says this must be opt-in. Done when it is off by default, a setting
  turns it on, and with it off a pasted link becomes a plain card with no
  network call.

### Verify in a real browser
- [ ] **Print PDF passes the KDP previewer** (the plan's "done when" for Phase 5): Node tests
  (`lib/print/*.test.tsx`) prove page size, trim and bleed boxes, embedded fonts, right-hand
  chapter starts and 366 pages in about 7 s, and the pages were checked by eye. Still needed:
  export a ~300-page 6×9 book in Chrome, Firefox and Safari, upload it to the KDP previewer
  (and IngramSpark's checker), and fix anything they flag. Only a person with an account can do this.
- [ ] **Print PDF speed in the browser**: rendering runs on the main thread. 7 s in Node may mean
  a frozen tab for a long book on a slow laptop. Measure, and if it's bad, move rendering into a
  Web Worker.
- [ ] **Cover PDF against real templates**: compare the cover size, spine width and barcode area
  with KDP's cover calculator and IngramSpark's cover template generator for a few page counts
  and both papers (`lib/print/specs.ts`, `lib/print/render-cover.tsx`).
- [ ] **Template packs in a browser**: import a pack whose fonts and ornament images load through
  object URLs, and export with it.
- [ ] **Folder backup**: test in Chrome and Edge (choose the folder, write, prune
  after seven days, reconnect after a restart).
- [ ] **Restore after clearing site data**: test by hand in each major browser.
- [ ] **Story Check in a real browser**: the panel, Go to text across chapters, the Web
  Worker (bundled by Turbopack; a main-thread fallback exists), and the
  flashback/year fields. Test in Chrome, Firefox and Safari.
- [ ] **Style tab and goals in Firefox and Safari**: checked in Chromium only (the Style tab,
  underlines, Go to text, Ignore, the settings, the footer goal counter and the Book Settings
  goal card). Wavy underlines use `text-decoration-style: wavy`; check they look right.

## Should fix before launch

- [ ] **Story Check only understands English**: colour words, action and speech verbs,
  memory cues and number words (`lib/story-check/vocab.ts`) are English. In
  other languages only name spelling, forgotten characters and open threads
  work. Either add vocabularies per language (from the project or browser
  locale), or say "English only" next to the affected rules.
- [ ] **Style checks only understand English**: the filler list is editable, but the
  adverb ("-ly"), passive-voice and repeated-word lists (`lib/style-check/words.ts`)
  are English. In other languages, turn those checks off by default or label them
  "English only".
- [ ] **Demo book with planted mistakes**: the plan's "done when" is covered by
  fixture tests (`lib/story-check/story-check.test.ts`), but a sample book
  that new writers can open (and the landing-page demo can show) doesn't
  exist yet. Ship it as a bundled project file imported from the empty
  dashboard.
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
- [x] **Legal pages**: `/privacy` and `/terms` exist (Phase 6). The privacy page says content never
  leaves the device. A legal review is still listed under "Going public".

## Print: known limits (decide whether to extend)

- [ ] **No large drop caps**: react-pdf overlaps the first two lines when one character in a line is
  much bigger than the rest, so templates offer a capitals lead-in instead. Revisit if react-pdf
  fixes this, or draw the initial as an absolutely positioned element with a manual indent.
- [ ] **EPUB and DOCX ignore print templates**: only the PDF uses them. Ebook styling could reuse
  the template's fonts and scene-break glyph.
- [ ] **Hyphenation is English only**: other languages fall back to react-pdf's English patterns.
- [ ] **Backups don't include imported templates**: a restored book that used a pack prints with
  Classic until the pack is imported again (Settings says to keep the pack file). Decide whether
  full backups should carry them.
- [ ] **Fonts add 4 MB**: the bundled TTFs are fetched on first print export and then cached
  offline. Subsetting them to the scripts they cover would shrink this.

## Story Check: known limits of v1 (decide whether to extend)

- [ ] **Pronouns aren't a rule**: they're stored and used only so "his blue eyes" isn't
  pinned on a "she". Checking pronoun use against a character would raise too
  many false alarms (other people in the scene), so v1 doesn't.
- [ ] **Height, build and other free-text facts aren't checked**: only eye colour, hair
  colour, death and birth year are structured.
- [ ] **Ages use years only**: chapter dates are read to the year, and ages allow one
  year either way because birthdays aren't recorded. An optional birth date
  would tighten this.
- [ ] **"Open thread" notes for every unresolved thread** may feel noisy mid-draft.
  Revisit after feedback (for example, only show them once the book is marked done).

## Style checks and goals: known limits of v1 (decide whether to extend)

- [ ] **Passive voice and adverbs are guesses**: "was opened" is caught, "had the door
  opened" isn't; "-ly" adjectives not on the skip list ("a costly mistake" is skipped,
  rarer ones aren't) are flagged. Collect false alarms from real writers and grow
  `lib/style-check/words.ts`.
- [ ] **Who-speaks stats need a name nearby**: a line is credited only when a tag or the
  paragraph names a character. "she said" stays "Not sure who". Using pronouns from the
  character profile, or alternating speakers in a two-person exchange, would credit more.
- [ ] **Style checks look at one chapter**: there is no whole-book Style view yet (for
  example, a word you overuse across the book).
- [ ] **Pasted text counts toward the daily goal**: a save counts every word gained, so
  pasting in an old chapter counts as writing it today. Consider ignoring a single
  jump of more than, say, 2,000 words, or asking.
- [ ] **No goals across all books**: goals and streaks are per book. A writer working on
  two books doesn't get one combined streak, and the dashboard doesn't show goals.
- [ ] **The day turns over only on the next change**: the footer counter re-reads after
  each save, so a tab left open past midnight shows yesterday's total until you type.

## Clean-up (no user impact)

- [ ] **Dead components**: `components/ui/create-button.tsx` (it still mentions the removed
  `safeAction`) and `components/project/section-coming-soon.tsx` are unused.
  Delete them.
- [ ] **Unused project field**: `targetWordCount` is stored but unused (`dailyWordGoal`
  now drives daily goals). Use it for a whole-book target, or drop it in a schema
  migration.

## Deliberately deferred (tracked in the plan)

- Donations: no Ko-fi page yet. `DONATE_URL` in `lib/brand.ts` stays empty, which hides every donate
  link. Set it when the page exists.

- Beta-reader sharing returns in Phase 7 as an exported reader file.
- Optional Google Drive backup and a desktop app (Tauri) are Phase 7.
