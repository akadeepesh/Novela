import { APP_NAME } from "@/lib/brand"

/**
 * The landing page's comparison table. Facts about other apps were checked
 * on 14 November 2026 against their own sites and recent reviews:
 *   Scrivener   — literatureandlatte.com/scrivener: $59.99 one-time (Mac or Windows), local files,
 *                 print PDF through Compile.
 *   Novelcrafter — novelcrafter.com/pricing: plans from $4/month; AI tools from the $8 plan, using
 *                 your own AI key; help page "format for export" says formatting for publication
 *                 is done in another program.
 *   Campfire    — campfirewriting.com/pricing: free tier with limits, paid modules (about $2/month
 *                 each) or a lifetime purchase; exports print-ready PDF and EPUB. We couldn't
 *                 confirm its AI features, so that cell says so.
 * Re-check before each launch post, and keep the date in COMPARISON_CHECKED in step.
 */
export const COMPARISON_CHECKED = "November 2026"

export type Cell = { text: string; good?: boolean }

export const COMPARISON_APPS = [APP_NAME, "Scrivener", "Novelcrafter", "Campfire"] as const

export const COMPARISON_ROWS: { label: string; cells: [Cell, Cell, Cell, Cell] }[] = [
  {
    label: "Price",
    cells: [
      { text: "Free, everything included", good: true },
      { text: "$59.99 once, per platform" },
      { text: "From $4 a month" },
      { text: "Free tier with limits; paid modules or lifetime" },
    ],
  },
  {
    label: "Where your book is kept",
    cells: [
      { text: "In your browser, on your device", good: true },
      { text: "Files on your computer", good: true },
      { text: "Your online account" },
      { text: "Your online account" },
    ],
  },
  {
    label: "Account needed",
    cells: [
      { text: "No", good: true },
      { text: "No (licence key)", good: true },
      { text: "Yes" },
      { text: "Yes" },
    ],
  },
  {
    label: "AI",
    cells: [
      { text: "None, ever", good: true },
      { text: "None", good: true },
      { text: "Built in (bring your own AI key)" },
      { text: "Not confirmed" },
    ],
  },
  {
    label: "Automatic continuity checks",
    cells: [
      { text: "Yes: dead characters, name typos, ages, eye colour, open threads", good: true },
      { text: "No" },
      { text: "No rule-based checks" },
      { text: "No" },
    ],
  },
  {
    label: "Print-ready PDF for KDP",
    cells: [
      { text: "Yes, with correct margins, bleed and a cover with spine", good: true },
      { text: "Yes, through Compile (you set it up)", good: true },
      { text: "Export, then format elsewhere" },
      { text: "Print-ready PDF export", good: true },
    ],
  },
]

/** Where the others are honestly better, shown under the table. */
export const OTHERS_ARE_BETTER = [
  { app: "Scrivener", text: "a mature desktop app with a research binder and very flexible compile settings." },
  { app: "Novelcrafter", text: "if you want AI help, or to write with a co-author." },
  { app: "Campfire", text: "mobile apps, sync across devices, and many worldbuilding modules." },
]
