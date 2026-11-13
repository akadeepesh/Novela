import type { Metadata } from "next"
import { GuidePage } from "@/components/marketing/guide-page"
import { StoryCheckDemo } from "@/components/marketing/story-check-demo"
import { APP_NAME } from "@/lib/brand"

const PATH = "/story-bible-app"
const TITLE = "A story bible app that checks your book against it"
const INTRO = `In ${APP_NAME}, your story bible isn't just a list of notes. Characters, places and plot threads are linked to your manuscript, and Story Check reads every chapter against them to catch the mistakes readers notice: a dead character who talks, a name spelled two ways, eyes that change colour.`

export const metadata: Metadata = {
  title: "Story bible app",
  description: `A free story bible app for novelists: characters, places and plot threads linked to your manuscript, with continuity checks that catch plot holes. ${APP_NAME} keeps everything on your device.`,
  alternates: { canonical: PATH },
}

export default function Page() {
  return (
    <GuidePage
      path={PATH}
      eyebrow="Story bible"
      title={TITLE}
      intro={INTRO}
      sections={[
        {
          heading: "What goes in it",
          points: [
            { title: "Characters", text: "Role, aliases, appearance, personality and backstory, plus story facts the checks use: eye and hair colour, birth year, pronouns, and whether they're alive, dead or missing (and from which chapter)." },
            { title: "World", text: "Locations, factions and items, each with aliases." },
            { title: "Plot threads", text: "Open questions and subplots, with the chapter where each one is resolved." },
            { title: "Notes and research", text: "A scratchpad for ideas and a board for links and clippings." },
          ],
        },
        {
          heading: "Linked to your manuscript",
          body: [
            "Type @ in a chapter to mention a character, place or thread. Each entry then shows every chapter it appears in, so you can jump to the last time a minor character was on the page.",
            "Plain names count too: Story Check finds characters and places by their names and aliases even when you don't use @.",
          ],
        },
        {
          heading: "Story Check catches what slips through",
          points: [
            { title: "Dead characters", text: "Someone marked dead speaks or acts in a later chapter. Chapters marked as flashbacks are allowed." },
            { title: "Name spelling", text: "“Marra” in chapter 12 when everyone else calls her Mara." },
            { title: "Character facts", text: "Green eyes in the profile, blue eyes on page 140." },
            { title: "Ages and dates", text: "A stated age that doesn't match the birth year and the chapter's year." },
            { title: "Forgotten characters", text: "A main character who hasn't appeared for many chapters." },
            { title: "Open threads", text: "Plot threads that are never resolved." },
          ],
        },
        {
          heading: "Rules, not guesses",
          body: [
            "These are plain rules that run on your device, not AI. Each issue has Go to text and Ignore, so a deliberate choice never nags you twice.",
          ],
        },
      ]}
      faq={[
        { q: "Is my story bible private?", a: "Yes. Like your manuscript, it stays in your browser on your device." },
        { q: "Does Story Check understand every language?", a: "Name spelling, forgotten characters and open threads work in any language. Checks that read words such as colours and speech verbs understand English for now." },
        { q: "Can I use it just as a story bible, without writing in it?", a: "You can, but the checks need your chapters to compare against." },
        { q: "Is it free?", a: "Yes, every feature, with no account." },
      ]}
    >
      <h2 className="mb-5 font-heading text-xl font-semibold tracking-tight text-foreground sm:text-2xl">See it work</h2>
      <StoryCheckDemo />
    </GuidePage>
  )
}
