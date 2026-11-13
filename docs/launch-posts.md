# Launch posts (drafts)

Drafts to post by hand. `[URL]` is https://novela.akadeepesh.com once the domain is live. Replace `[REPO]` with the public repo
once it is open. Before posting anywhere:

- Re-check the comparison facts (`lib/marketing/comparison.ts`) if more than a month has passed.
- Read each subreddit's rules. Several allow self-promotion only in a weekly thread, or not at all.
  Post there only if allowed, and reply to comments yourself.
- Never post fake reviews or testimonials, and don't ask friends to upvote. Communities ban for it.

---

## Show HN

**Title:** Show HN: Novela – a free, local-first novel writing app that catches plot holes (no AI)

**Text:**

I write fiction, and every tool I tried either wanted a subscription and my manuscript on its servers,
or was a folder of documents with no structure. So I built a writing app that runs entirely in the
browser and keeps everything in IndexedDB on your own device. There's no account and no backend for
books.

The part I'm most interested in feedback on is Story Check: plain rules (no LLM) that read the
manuscript against a story bible. It flags a character marked dead who speaks in a later chapter, a name
that's probably a typo of a known one (edit distance, frequency, and whether the word ever appears in
lower case), an age that doesn't match a birth year and the chapter's date, eye colour that contradicts
the profile, and plot threads that never resolve. It runs in a Web Worker on every change.

Other bits:
- Style checks (repeats, filler words, long sentences, adverbs, passive voice) as editor decorations.
- Print-ready PDF for Amazon KDP: gutter by page count, mirrored margins, embedded fonts, and a cover PDF
  with the spine sized from the page count and paper. Built with react-pdf and pdf-lib, in the browser.
- Backups are zip files; Chromium browsers can write daily backups to a folder you pick.

Stack: Next.js, Tiptap, Dexie. AGPL-3.0. The only server call involving user input is fetching link
previews in the research board (URL only).

It's free. The plan is to fund it with optional paid print template packs, sold once.

Known limits: the language checks are English-only, there's no sync between devices (backup files
instead), and Safari can't do folder backups.

[URL] · [REPO]

---

## Product Hunt

**Name:** Novela

**Tagline (60 characters max):** Free, private novel writing app that catches plot holes

**Description:**
Write your novel in your browser, with your book kept on your device. A story bible that checks your
chapters for continuity mistakes, style checks, daily goals, and print-ready PDFs for Amazon KDP. No
account, no subscription, no AI.

**First comment (from the maker):**
Hi everyone. I built Novela because I wanted a writing app that respected unpublished work: no
uploading my manuscript, no AI training, no subscription. Its favourite trick is Story Check. Mark a
character as dead in chapter 3, and if they speak in chapter 9, it tells you. It also spots misspelled
names, ages that don't add up, and plot threads you forgot to close. When you're done, it exports a
paperback PDF with KDP's margins and a cover sized to your spine. Everything is free. I'd love to hear
what would make it your main writing tool.

**Gallery:** use `docs/screenshots/` (landing, Story Check, style checks, goals, export) and a 20-second
screen recording of the Story Check demo.

---

## r/selfpublish

**Title:** I made a free tool that exports KDP-ready paperback PDFs (margins by page count, cover with spine)

**Body:**
Formatting was the step I dreaded most, so I built it into the writing app I use. You pick a trim size
(5×8 up to 8.5×11) and one of three free templates, and it exports an interior PDF with KDP's minimum
gutter for your page count, mirrored margins, embedded fonts, a title page, copyright page and table of
contents. Then it makes a one-piece cover PDF (back, spine, front) sized for your page count and paper.

It's free, runs in your browser, and your book stays on your computer. Please still run everything
through KDP's previewer and order a proof. If it flags anything, I'd really like to know what, so I can
fix it.

[URL]

---

## r/fantasywriters

**Title:** Free app that checks your manuscript against your story bible (dead characters talking, name typos, ages)

**Body:**
If you track a lot of lore, you know the feeling of realising a character who died in book one just
showed up at a feast. I built a free writing app with a story bible that checks your chapters against
it: dead or missing characters who appear later (flashback chapters are allowed), names that look like
typos of your characters or places, eye and hair colour that contradicts their profile, ages that don't
match birth years, and plot threads you never resolved.

No AI. It's plain rules, it runs on your device, and your book never leaves it. I'd love feedback from
people with big casts: what does it miss, and what does it flag that it shouldn't?

[URL]

---

## r/NaNoWriMo

**Title:** A free, private writing app with daily word goals and streaks (and it never counts deletions against you)

**Body:**
For anyone still going this November: I made a free writing app where you set a daily goal (1,667 words
a day reaches 50k), and it tracks your streak. Deleting or rewriting text never takes words off your
day, so an editing session doesn't break your streak. It also has a story bible, style checks and
distraction-free mode. No account; your words stay in your browser.

[URL]

---

## r/writing

Check the rules first. r/writing usually doesn't allow self-promotion outside specific threads. If it's
allowed, use a short version of the r/fantasywriters post and lead with the question, not the link:
"What continuity mistakes have slipped into your drafts?"

---

## Short video script (TikTok, Reels, Shorts), about 25 seconds

1. (0–3 s) Text on screen: "My writing app caught a plot hole." Face to camera or hands on keyboard.
2. (3–10 s) Screen recording: type "“You came back,” Tomas said." in a later chapter.
3. (10–15 s) The Story Check card slides in: "Tomas died in “The Fall”, but speaks here." Zoom on it.
4. (15–20 s) Click Go to text, mark the chapter as a flashback, and the warning goes away.
5. (20–25 s) Text: "Free. Private. No AI." Then the URL.

Caption: "Free writing app that checks your continuity so readers don't have to. No AI, your book stays
on your device. #writingtok #booktok #amwriting #selfpublishing"

Record from the real app with a demo book, not the landing page mock.
