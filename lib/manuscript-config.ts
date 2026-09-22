// Every preset sets its OWN ink color alongside its background — the page
// is meant to look like a physical sheet, so its contrast can't depend on
// whether the app chrome around it happens to be in light or dark mode.
// (Previously only "midnight" did this; every light preset silently
// inherited the ambient theme foreground, which turned near-invisible —
// light ink on a light sheet — whenever the app itself was in dark mode.)
const INK_LIGHT = "oklch(0.24 0.014 55)" // matches :root --foreground
const INK_DARK = "oklch(0.92 0.006 75)" // matches .dark --foreground

export const BACKGROUND_PRESETS = [
  {
    id: "paper",
    label: "Paper",
    swatch: "oklch(0.995 0.003 75)",
    style: { background: "oklch(0.995 0.003 75)", color: INK_LIGHT },
  },
  {
    id: "cream",
    label: "Cream",
    swatch: "oklch(0.97 0.015 85)",
    style: { background: "oklch(0.97 0.015 85)", color: INK_LIGHT },
  },
  {
    id: "linen",
    label: "Linen",
    swatch: "oklch(0.95 0.012 75)",
    style: {
      backgroundColor: "oklch(0.95 0.012 75)",
      backgroundImage:
        "repeating-linear-gradient(45deg, oklch(0.93 0.012 75) 0px, oklch(0.93 0.012 75) 1px, transparent 1px, transparent 10px)",
      color: INK_LIGHT,
    },
  },
  {
    id: "sage",
    label: "Sage tint",
    swatch: "oklch(0.95 0.02 145)",
    style: { background: "oklch(0.95 0.02 145)", color: INK_LIGHT },
  },
  {
    id: "midnight",
    label: "Midnight",
    swatch: "oklch(0.22 0.015 260)",
    style: { background: "oklch(0.22 0.015 260)", color: INK_DARK },
  },
] as const

export const BACKGROUND_IDS = BACKGROUND_PRESETS.map((b) => b.id)
export type BackgroundId = (typeof BACKGROUND_PRESETS)[number]["id"]

export function getBackgroundPreset(id: string) {
  return BACKGROUND_PRESETS.find((b) => b.id === id) ?? BACKGROUND_PRESETS[0]
}

export const LINE_WIDTHS = ["narrow", "medium", "wide"] as const
export type LineWidth = (typeof LINE_WIDTHS)[number]

export const LINE_WIDTH_PX: Record<LineWidth, string> = {
  narrow: "38rem",
  medium: "46rem",
  wide: "56rem",
}

export type ManuscriptSettings = {
  background: BackgroundId
  showHeader: boolean
  headerText: string
  showFooter: boolean
  footerText: string
  fontSize: number
  lineHeight: number
  lineWidth: LineWidth
}

export const DEFAULT_MANUSCRIPT_SETTINGS: ManuscriptSettings = {
  background: "paper",
  showHeader: false,
  headerText: "",
  showFooter: false,
  footerText: "",
  fontSize: 18,
  lineHeight: 1.75,
  lineWidth: "medium",
}
