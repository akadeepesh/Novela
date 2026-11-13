import type { Metadata } from "next"
import { GuidePage } from "@/components/marketing/guide-page"
import { TemplateShowcase } from "@/components/marketing/blocks"
import { APP_NAME } from "@/lib/brand"

const PATH = "/kdp-formatting-free"
const TITLE = "Format your book for Amazon KDP, free"
const INTRO = `${APP_NAME} turns your manuscript into a print-ready PDF interior for Amazon KDP paperbacks, and IngramSpark too, with the right margins for your page count, embedded fonts and a matching cover. No formatting software to buy and no account.`

export const metadata: Metadata = {
  title: "Free KDP book formatting",
  description: `Free KDP formatting: export a print-ready paperback PDF with correct margins, mirrored pages, embedded fonts, front matter and a cover sized to your spine. ${APP_NAME} runs in your browser.`,
  alternates: { canonical: PATH },
}

export default function Page() {
  return (
    <GuidePage
      path={PATH}
      eyebrow="KDP formatting"
      title={TITLE}
      intro={INTRO}
      sections={[
        {
          heading: "What KDP checks, and how it's handled",
          points: [
            { title: "Trim size", text: "Choose 5×8, 5.25×8, 5.5×8.5, 6×9 or 8.5×11 inches. The PDF page is exactly that size, or a little larger when you choose bleed." },
            { title: "Inside margin by page count", text: "KDP needs a wider inside (gutter) margin for thicker books: from 0.375 in up to 150 pages to 0.875 in past 700. The margin is set for your book's real page count." },
            { title: "Mirrored pages", text: "Right- and left-hand pages are mirrored so the wider margin is always on the binding side." },
            { title: "Embedded fonts", text: "Every font is embedded in the PDF. KDP rejects files with fonts that aren't, and an automated test checks this on every change." },
            { title: "Bleed", text: "Turn on bleed if anything runs to the edge of the page. The page grows by 0.125 in on the outside, top and bottom." },
          ],
        },
        {
          heading: "Everything a paperback interior needs",
          points: [
            { text: "A title page, an editable copyright page (add your ISBN there), a dedication and a table of contents with real page numbers." },
            { text: "Chapters that start on a right-hand page if you like, with no page number or running head on chapter openers." },
            { text: "Scene breaks with an ornament, running heads with your name and the title, and page numbers." },
            { text: "A print summary after export: page count, margins, spine width and cover size, with a warning if the font can't print some of your characters." },
          ],
        },
        {
          heading: "The cover, sized for you",
          body: [
            "KDP's cover is one PDF: back, spine and front. Its width depends on your trim size, your page count and the paper (white or cream). Export the interior first, then download a cover PDF at exactly the right size, made from your own cover images or set in type on a colour you choose. It warns you if an image isn't sharp enough to print.",
          ],
        },
        {
          heading: "Before you publish",
          body: [
            "Upload the interior and cover to KDP and go through its previewer page by page, then order a proof copy. No tool can promise a file will pass every check, so the previewer is the final word.",
          ],
        },
      ]}
      faq={[
        { q: "Does it work for IngramSpark too?", a: "Yes. Choose IngramSpark as the printer and the margins follow its rules (at least 0.5 in on every side)." },
        { q: "Can I use my own fonts?", a: "The three free templates use open-licence fonts. Template packs can bring other fonts, and the template format is documented if you want to make your own." },
        { q: "What about ebooks?", a: "Export an EPUB for Kindle and other stores. The print templates apply to the PDF." },
        { q: "Is it really free?", a: "Yes, including the three templates and the cover PDF. Optional genre template packs will be sold once." },
      ]}
    >
      <h2 className="mb-5 font-heading text-xl font-semibold tracking-tight text-foreground sm:text-2xl">The free templates</h2>
      <TemplateShowcase />
    </GuidePage>
  )
}
