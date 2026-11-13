import { it } from "vitest"
import { writeFileSync } from "node:fs"
import path from "node:path"
import { CLASSIC } from "./builtin-templates"
import { renderPrintPdf } from "./render-print"
import { sampleBook } from "./fixtures"

/**
 * Times a full-length novel (~300 pages). Skipped unless PRINT_TIMING names
 * a file to write the results to:
 *   PRINT_TIMING=timing.txt npm test -- lib/print/timing
 */
it.runIf(process.env.PRINT_TIMING)("times a full-length novel", async () => {
  const doc = sampleBook(30, 70)
  const t0 = Date.now()
  const lines: string[] = []
  const { blob, report } = await renderPrintPdf(doc, {
    template: CLASSIC,
    trimSizeId: "6x9",
    printer: "kdp",
    bleed: false,
    resolveFile: (r) => path.resolve("public", r.replace(/^\//, "")),
    onProgress: (s) => lines.push(`${((Date.now() - t0) / 1000).toFixed(1)}s ${s}`),
  })
  lines.push(
    `pages=${report.pageCount} front=${report.frontPages} gutter=${report.geometry.margins.inside} size=${Math.round(blob.size / 1024)}KB total=${((Date.now() - t0) / 1000).toFixed(1)}s`,
    `starts ${[...report.starts.values()].slice(0, 8).join(",")} warnings ${JSON.stringify(report.warnings)}`
  )
  writeFileSync(process.env.PRINT_TIMING!, lines.join("\n"))
}, 600_000)
