export const BACKGROUND_PRESETS = [
  {
    id: "paper",
    label: "Paper",
    swatch: "oklch(0.995 0.003 75)",
    style: { background: "var(--manuscript-bg)" },
  },
  {
    id: "cream",
    label: "Cream",
    swatch: "oklch(0.97 0.015 85)",
    style: { background: "oklch(0.97 0.015 85)" },
  },
  {
    id: "linen",
    label: "Linen",
    swatch: "oklch(0.95 0.012 75)",
    style: {
      backgroundColor: "oklch(0.95 0.012 75)",
      backgroundImage:
        "repeating-linear-gradient(45deg, oklch(0.93 0.012 75) 0px, oklch(0.93 0.012 75) 1px, transparent 1px, transparent 10px)",
    },
  },
  {
    id: "sage",
    label: "Sage tint",
    swatch: "oklch(0.95 0.02 145)",
    style: { background: "oklch(0.95 0.02 145)" },
  },
  {
    id: "midnight",
    label: "Midnight",
    swatch: "oklch(0.22 0.015 260)",
    style: { background: "oklch(0.22 0.015 260)", color: "oklch(0.92 0.006 75)" },
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
