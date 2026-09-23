// Part 4.2 — a trim-size default set here means Export isn't the first
// place you discover what a page will actually look like. PDF is the only
// export format with a fixed page size (EPUB reflows, DOCX exports at
// standard US Letter) so this only drives renderPdf.

export const TRIM_SIZES = [
  {
    id: "6x9",
    label: "6 × 9 in",
    sublabel: "Trade paperback — the standard for most novels",
    widthIn: 6,
    heightIn: 9,
    marginIn: { top: 0.9, bottom: 0.8, horizontal: 0.78 },
  },
  {
    id: "5.5x8.5",
    label: "5.5 × 8.5 in",
    sublabel: "Digest — common for poetry and novellas",
    widthIn: 5.5,
    heightIn: 8.5,
    marginIn: { top: 0.8, bottom: 0.7, horizontal: 0.65 },
  },
  {
    id: "5x8",
    label: "5 × 8 in",
    sublabel: "Compact — mass-market paperback feel",
    widthIn: 5,
    heightIn: 8,
    marginIn: { top: 0.7, bottom: 0.65, horizontal: 0.55 },
  },
  {
    id: "8.5x11",
    label: "8.5 × 11 in",
    sublabel: "US Letter — manuscript-format or script standard",
    widthIn: 8.5,
    heightIn: 11,
    marginIn: { top: 1, bottom: 0.9, horizontal: 1 },
  },
] as const

export type TrimSizeId = (typeof TRIM_SIZES)[number]["id"]
export const TRIM_SIZE_IDS = TRIM_SIZES.map((t) => t.id)

export function getTrimSize(id: string) {
  return TRIM_SIZES.find((t) => t.id === id) ?? TRIM_SIZES[0]
}

const POINTS_PER_INCH = 72

/** react-pdf `<Page size>` tuple, in points. */
export function trimSizePagePoints(id: string): [number, number] {
  const t = getTrimSize(id)
  return [t.widthIn * POINTS_PER_INCH, t.heightIn * POINTS_PER_INCH]
}

/** react-pdf page padding, in points. */
export function trimSizeMarginPoints(id: string) {
  const t = getTrimSize(id)
  return {
    top: t.marginIn.top * POINTS_PER_INCH,
    bottom: t.marginIn.bottom * POINTS_PER_INCH,
    horizontal: t.marginIn.horizontal * POINTS_PER_INCH,
  }
}
