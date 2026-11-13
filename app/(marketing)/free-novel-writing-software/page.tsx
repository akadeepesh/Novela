import type { Metadata } from "next"
import { GuidePage } from "@/components/marketing/guide-page"
import { APP_NAME } from "@/lib/brand"

const PATH = "/free-novel-writing-software"
const TITLE = "Free novel writing software, with nothing held back"
const INTRO = `${APP_NAME} is novel writing software that is free in full: no trial, no word limit, no premium tier. Write your draft, keep track of your characters and world, catch continuity mistakes, and export a paperback-ready PDF, all in your browser.`

export const metadata: Metadata = {
  title: "Free novel writing software",
  description: `${APP_NAME} is free novel writing software for drafting, planning and publishing: a manuscript editor, story bible, continuity and style checks, and KDP-ready export. No account, no AI, no limits.`,
  alternates: { canonical: PATH },
}

export default function Page() {
  return (
    <GuidePage
      path={PATH}
      eyebrow="Novel writing software"
      title={TITLE}
      intro={INTRO}
      sections={[
        {
          heading: "What you get",
          points: [
            { title: "A manuscript editor", text: "Chapters with autosave, version history, comments in the margin, find and replace, and focus, typewriter and distraction-free modes." },
            { title: "A story bible", text: "Characters, places and plot threads. Mention them in your text with @ and see every chapter they appear in." },
            { title: "Story Check", text: "Plain rules that catch plot holes: dead characters who come back, names spelled two ways, ages that don't add up, and threads left hanging." },
            { title: "Style checks", text: "Repeated words, filler words, long sentences, adverbs and passive voice, plus dialogue and narration stats for each chapter." },
            { title: "Goals", text: "A daily word goal with a streak, useful for NaNoWriMo or any writing habit." },
            { title: "Publishing", text: "A print-ready PDF and cover for Amazon KDP and IngramSpark, plus EPUB and Word files." },
          ],
        },
        {
          heading: "Why it's free",
          body: [
            "The app runs on your own device, so there are no servers storing books and no running cost per writer. That's what makes it possible to give every feature away.",
            "The project is funded by optional print template packs for different genres, sold once, and by donations. No feature in the app is ever locked behind them.",
          ],
        },
        {
          heading: "Who it's for",
          body: [
            "Novelists who want one place for the draft and everything behind it; fantasy and science fiction writers with a lot of lore to keep straight; and indie authors who want to go from draft to paperback without paying for separate formatting software.",
            "It works for poetry and scripts too, with sections that fit each kind of project.",
          ],
        },
        {
          heading: "What it won't do",
          body: [
            "It won't write for you. There is no AI in it, and your text is never sent to one. It also isn't a collaboration tool: your book lives on one device, and you share it by sending a project file.",
          ],
        },
      ]}
      faq={[
        { q: "Is there a limit on books or words?", a: "No. Write as many books as you like, as long as you like." },
        { q: "Do I need to create an account?", a: "No. Open the app and start writing." },
        { q: "Can I use it on more than one computer?", a: "Yes. Download a project file on one computer and open it on another, or keep backups in a synced folder such as Dropbox." },
        { q: "Is it good for NaNoWriMo?", a: "Yes. Set a daily goal (1,667 words a day finishes 50,000 in November), and the streak keeps you going." },
      ]}
    />
  )
}
