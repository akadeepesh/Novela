import type { Metadata } from "next"
import Link from "next/link"
import {
  ArrowDownIcon,
  BookOpenTextIcon,
  CloudSlashIcon,
  DownloadSimpleIcon,
  HardDrivesIcon,
  ListChecksIcon,
  PrinterIcon,
  SparkleIcon,
  TargetIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react/dist/ssr"
import { StoryCheckDemo } from "@/components/marketing/story-check-demo"
import { ComparisonTable, FaqList, JsonLd, Section, StartButton, TemplateShowcase, type Faq } from "@/components/marketing/blocks"
import { APP_NAME, DESCRIPTION, DONATE_URL, HEADLINE, REPO_URL } from "@/lib/brand"

export const metadata: Metadata = {
  title: { absolute: `${APP_NAME}: free novel writing software that catches your plot holes` },
  description: DESCRIPTION,
  alternates: { canonical: "/" },
}

const FEATURES = [
  {
    icon: ListChecksIcon,
    title: "Story Check",
    text: "Catches a dead character who speaks again, a misspelled name, an age that doesn't add up, eyes that change colour, and plot threads you never closed. Plain rules, no AI.",
  },
  {
    icon: UsersThreeIcon,
    title: "A story bible that stays in sync",
    text: "Characters, places and plot threads, linked from your text with @mentions. See every chapter a character appears in.",
  },
  {
    icon: SparkleIcon,
    title: "Style checks",
    text: "Repeated words, filler words, long sentences, adverbs and passive voice, plus chapter stats: dialogue versus narration and who speaks most.",
  },
  {
    icon: TargetIcon,
    title: "Daily goals and streaks",
    text: "Set a daily word goal and keep a streak going. Deleting words never costs you progress, so editing days still count.",
  },
  {
    icon: PrinterIcon,
    title: "Print-ready books",
    text: "A PDF for Amazon KDP and IngramSpark with the right margins for your page count, mirrored pages, front matter, and a cover with the spine sized for you.",
  },
  {
    icon: BookOpenTextIcon,
    title: "A calm place to write",
    text: "Focus and typewriter modes, version history, comments in the margin, and EPUB and Word export when you need them.",
  },
]

const PRIVACY = [
  {
    icon: HardDrivesIcon,
    title: "Stored in your browser",
    text: "Your chapters, notes and images live in your browser's own storage on this device. There is no account and no server copy.",
  },
  {
    icon: CloudSlashIcon,
    title: "Keeps working offline",
    text: "Install it like an app. Once you've opened a book, you can keep writing it without a connection.",
  },
  {
    icon: DownloadSimpleIcon,
    title: "Backups you control",
    text: "Download a backup file any time, or point it at a folder (in Chrome and Edge) for automatic daily copies, including into a Dropbox or Google Drive folder.",
  },
]

const FAQ: Faq[] = [
  {
    q: "Is it really free?",
    a: "Yes. Every feature is free with no limits on books or words. The project is funded by optional print template packs, sold once, and by donations.",
  },
  {
    q: "Where is my book stored?",
    a: "In your browser's storage on your own device. Nothing you write is sent to a server. The one exception: if you paste a link in Research, that link (and only the link) is fetched to show a preview.",
  },
  {
    q: "What happens if I clear my browser data?",
    a: "Your books would be deleted, like any local file. Download a backup now and then, or turn on folder backup, and you can restore everything in a minute, on any computer.",
  },
  {
    q: "Does it use AI?",
    a: "No. It never writes for you and never sends your text to an AI. Story Check and the style checks are plain rules that run on your device.",
  },
  {
    q: "Can I publish on Amazon KDP with it?",
    a: "Yes. Export a print-ready PDF interior with fonts embedded and margins set for your page count, plus a matching cover PDF. Always check the proof in KDP's previewer before you publish.",
  },
  {
    q: "Does it work on a phone?",
    a: "It runs in a mobile browser, but it's built for writing on a laptop or desktop with a keyboard.",
  },
]

export default function Home() {
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: APP_NAME,
          applicationCategory: "LifestyleApplication",
          operatingSystem: "Web browser",
          description: DESCRIPTION,
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        }}
      />

      <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 pt-16 pb-12 sm:pt-24 lg:grid-cols-[1fr_1.15fr]">
        <div className="flex flex-col items-start gap-6">
          <h1 className="font-heading text-4xl leading-[1.1] font-semibold tracking-tight text-foreground sm:text-5xl">{HEADLINE}</h1>
          <p className="max-w-xl font-serif text-lg leading-relaxed text-muted-foreground">
            {APP_NAME} is novel writing software with a story bible that checks your continuity for you. It
            runs in your browser, keeps your book on your device, and exports print-ready files for Amazon KDP.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <StartButton />
            <Link href="#demo" className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
              See it catch a plot hole
              <ArrowDownIcon className="size-3.5" />
            </Link>
          </div>
          <p className="text-sm text-muted-foreground">No account. Nothing to install. Your book stays on your device.</p>
        </div>
        <div id="demo" className="scroll-mt-20">
          <StoryCheckDemo />
        </div>
      </section>

      <Section
        id="features"
        eyebrow="Features"
        title="Everything a novel needs, from first draft to paperback"
        intro="Built for novelists, fantasy and sci-fi writers with a lot of lore to track, and indie authors who publish themselves."
      >
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-xl border border-border bg-card p-5">
              <f.icon className="mb-3 size-6 text-primary" weight="duotone" />
              <h3 className="font-heading font-semibold text-foreground">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </div>
      </Section>

      <div className="bg-muted/40">
        <Section
          id="privacy"
          eyebrow="Privacy"
          title="Your book never leaves your device"
          intro="Unpublished work is valuable. It shouldn't sit on someone else's server, or be used to train an AI."
        >
          <div className="grid gap-6 sm:grid-cols-3">
            {PRIVACY.map((p) => (
              <div key={p.title}>
                <p.icon className="mb-3 size-6 text-primary" weight="duotone" />
                <h3 className="font-heading font-semibold text-foreground">{p.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{p.text}</p>
              </div>
            ))}
          </div>
          <p className="mt-8 max-w-2xl text-sm text-muted-foreground">
            The one network call: when you paste a link into Research, the link itself is fetched to show a
            title and image. Your writing is never sent. Read the{" "}
            <Link href="/privacy" className="font-medium text-primary hover:underline">
              privacy page
            </Link>
            .
          </p>
        </Section>
      </div>

      <Section
        id="templates"
        eyebrow="Print templates"
        title="Paperbacks that look professionally typeset"
        intro="Three free interior templates, with fonts that are free to use and embedded in the PDF. Pick one and export."
      >
        <TemplateShowcase />
      </Section>

      <Section id="compare" eyebrow="Compare" title={`How ${APP_NAME} compares`}>
        <ComparisonTable />
      </Section>

      <Section id="faq" eyebrow="Questions" title="Good to know">
        <FaqList items={FAQ} />
      </Section>

      <section className="mx-auto max-w-3xl px-6 py-16 text-center">
        <h2 className="font-heading text-3xl font-semibold tracking-tight text-foreground">Start your book today</h2>
        <p className="mt-3 text-muted-foreground">Free, private, and ready in a second. No sign-up.</p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <StartButton />
        </div>
        {DONATE_URL || REPO_URL ? (
          <p className="mt-6 text-sm text-muted-foreground">
            {DONATE_URL ? (
              <a href={DONATE_URL} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">
                Support it on Ko-fi
              </a>
            ) : null}
            {DONATE_URL && REPO_URL ? " · " : null}
            {REPO_URL ? (
              <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">
                Read the source code
              </a>
            ) : null}
          </p>
        ) : null}
      </section>
    </>
  )
}
