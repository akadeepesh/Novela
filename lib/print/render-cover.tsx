import { Document, Font, Image, Page, Text, View, pdf } from "@react-pdf/renderer"
import { coverSize, POINTS_PER_INCH, type Paper } from "./specs"
import type { PrintTemplate } from "./template"

/**
 * A one-piece paperback cover (back, spine, front) at the exact size KDP and
 * IngramSpark ask for, including 0.125 in bleed on every edge. The front and
 * back use the book's cover images when it has them; otherwise they're set
 * in type on a plain colour. The barcode area on the back is kept clear.
 */

export type CoverOptions = {
  title: string
  author?: string
  blurb?: string
  /** Data URLs (or file paths in tests). */
  frontImage?: string
  backImage?: string
  template: PrintTemplate
  trimSizeId: string
  pageCount: number
  paper: Paper
  /** Background colour, e.g. "#1f2a36". */
  background: string
  resolveFile: (ref: string) => string
}

/** White or near-black text, whichever reads better on `hex`. */
export function textColourFor(hex: string): string {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim())
  if (!m) return "#ffffff"
  const [r, g, b] = m.slice(1).map((h) => parseInt(h, 16) / 255)
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return lum > 0.55 ? "#1b1b1b" : "#ffffff"
}

/** KDP prints the barcode in a 2 × 1.2 in box, 0.25 in from the trim at the bottom right of the back. */
const BARCODE = { widthIn: 2, heightIn: 1.2, insetIn: 0.25 }

export async function renderCoverPdf(opts: CoverOptions): Promise<Blob> {
  const size = coverSize({ trimSizeId: opts.trimSizeId, pageCount: opts.pageCount, paper: opts.paper })
  const P = POINTS_PER_INCH
  const family = `cover::${opts.template.id}`
  const spec = opts.template.fonts.heading ?? opts.template.fonts.body
  Font.register({
    family,
    fonts: [
      { src: opts.resolveFile(spec.regular), fontWeight: 400 },
      { src: opts.resolveFile(spec.italic ?? spec.regular), fontWeight: 400, fontStyle: "italic" },
      { src: opts.resolveFile(spec.bold ?? spec.regular), fontWeight: 700 },
    ],
  })

  const W = size.widthIn * P
  const H = size.heightIn * P
  const bleed = size.bleedIn * P
  const trimW = size.trim.widthIn * P
  const spine = size.spineIn * P
  const backW = bleed + trimW // back panel, including the left bleed
  const frontX = backW + spine
  const ink = textColourFor(opts.background)
  const safe = 0.5 * P // keep text this far inside the trim

  return pdf(
    <Document title={`${opts.title} (cover)`} author={opts.author} creator="" producer="">
      <Page size={[W, H]} style={{ backgroundColor: opts.background, fontFamily: family, color: ink }}>
        {/* Back */}
        {opts.backImage ? (
          // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt
          <Image src={opts.backImage} style={{ position: "absolute", left: 0, top: 0, width: backW, height: H, objectFit: "cover" }} />
        ) : opts.blurb ? (
          <View
            style={{
              position: "absolute",
              left: bleed + safe,
              top: bleed + safe * 1.4,
              width: trimW - safe * 2,
              height: H - bleed * 2 - safe * 2.4 - (BARCODE.heightIn + BARCODE.insetIn) * P,
            }}
          >
            <Text style={{ fontSize: 11.5, lineHeight: 1.5, textAlign: "left" }}>{opts.blurb}</Text>
          </View>
        ) : null}

        {/* Spine */}
        {size.spineText ? (
          <View
            style={{
              position: "absolute",
              left: backW + spine / 2 - (H - bleed * 2) / 2,
              top: H / 2 - spine / 2,
              width: H - bleed * 2,
              height: spine,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 0.6 * P,
              transform: "rotate(90deg)",
            }}
          >
            <Text style={{ fontSize: Math.min(14, spine * 0.45), fontWeight: 700 }}>{opts.title}</Text>
            {opts.author ? <Text style={{ fontSize: Math.min(11, spine * 0.36) }}>{opts.author}</Text> : null}
          </View>
        ) : null}

        {/* Front */}
        {opts.frontImage ? (
          // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt
          <Image src={opts.frontImage} style={{ position: "absolute", left: frontX, top: 0, width: W - frontX, height: H, objectFit: "cover" }} />
        ) : (
          <View
            style={{
              position: "absolute",
              left: frontX + safe,
              top: bleed + safe,
              width: trimW - safe * 2,
              height: H - bleed * 2 - safe * 2,
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text style={{ marginTop: H * 0.18, fontSize: 34, fontWeight: 700, textAlign: "center", lineHeight: 1.15 }}>{opts.title}</Text>
            {opts.author ? <Text style={{ fontSize: 15, letterSpacing: 2, textAlign: "center" }}>{opts.author.toUpperCase()}</Text> : null}
          </View>
        )}
      </Page>
    </Document>
  ).toBlob()
}
