import type { Metadata } from "next"
import { GuidePage } from "@/components/marketing/guide-page"
import { ComparisonTable } from "@/components/marketing/blocks"
import { APP_NAME } from "@/lib/brand"

const PATH = "/free-scrivener-alternative"
const TITLE = "A free Scrivener alternative that checks your story for you"
const INTRO = `${APP_NAME} is a free writing app for novelists that does much of what people use Scrivener for: chapters you can reorder, a place for characters and research, version history and export. It runs in your browser, needs no account or licence, and adds something Scrivener doesn't have: automatic continuity checks.`

export const metadata: Metadata = {
  title: "Free Scrivener alternative",
  description: `Looking for a free Scrivener alternative? ${APP_NAME} is free, private novel writing software with a story bible, continuity checks and print-ready PDFs for KDP. No account, no AI.`,
  alternates: { canonical: PATH },
}

export default function Page() {
  return (
    <GuidePage
      path={PATH}
      eyebrow="Scrivener alternative"
      title={TITLE}
      intro={INTRO}
      sections={[
        {
          heading: "What carries over from Scrivener",
          points: [
            { title: "Chapters you can move around", text: "Write in chapters, drag them into a new order, and give each a synopsis, a status and a label." },
            { title: "Characters, places and research beside your draft", text: "A story bible for characters, world and plot threads, plus notes and a research board for links and clippings." },
            { title: "Snapshots", text: "Every chapter keeps its history. Take a named snapshot before a big rewrite, compare versions and roll back." },
            { title: "Focus modes", text: "Distraction-free, focus and typewriter modes, and a page you can style with your own font, size and background." },
            { title: "Export", text: "PDF, EPUB and Word, plus a print-ready PDF interior and cover for Amazon KDP and IngramSpark." },
          ],
        },
        {
          heading: "What it adds",
          points: [
            { title: "Story Check", text: "It reads your manuscript against your story bible and flags a dead character who speaks again, a name spelled two ways, an age that doesn't match the year, eyes that change colour, and plot threads you never closed." },
            { title: "Style checks", text: "Repeated words, filler words, long sentences, adverbs and passive voice, with optional underlines in the text." },
            { title: "Daily goals and streaks", text: "Set a daily word target. Deleting words never takes away from the day's count." },
            { title: "Nothing to install or buy", text: "Open it in a browser and start. It's free, with no limits on books or words." },
          ],
        },
        {
          heading: "Where Scrivener is still better",
          body: [
            "Scrivener has been refined for many years. Its compile settings are more flexible, its research binder can hold PDFs, images and media, and its desktop apps save real files you can open with other tools. If you rely on a complex compile setup, or on Scrivener's corkboard and outliner views, you may miss them.",
            `${APP_NAME} keeps your book in your browser's storage. That makes it private and quick to start, but it means you should download a backup now and then, or turn on folder backup in Chrome or Edge.`,
          ],
        },
        {
          heading: "Moving a book over",
          body: [
            "Paste each chapter into a new chapter. Formatting such as italics and headings comes across. Then add your main characters, places and plot threads to the story bible so Story Check has something to compare against.",
          ],
        },
      ]}
      faq={[
        { q: "Is it really free?", a: "Yes. Every feature is free. The project is funded by optional print template packs, sold once." },
        { q: "Can I import a Scrivener project file?", a: "Not directly. Copy and paste each chapter for now; italics, bold and headings are kept." },
        { q: "Does it work offline like Scrivener?", a: "Once you've opened it, yes. Install it as an app from your browser, and books you've opened keep working without a connection." },
        { q: "Is my book uploaded anywhere?", a: "No. Everything stays in your browser on your device. There's no account and no server copy." },
      ]}
    >
      <h2 className="mb-5 font-heading text-xl font-semibold tracking-tight text-foreground sm:text-2xl">Side by side</h2>
      <ComparisonTable />
    </GuidePage>
  )
}
