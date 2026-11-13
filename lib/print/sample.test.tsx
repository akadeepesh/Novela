import { it } from "vitest"
import { writeFileSync } from "node:fs"
import path from "node:path"
import { BUILTIN_TEMPLATES } from "./builtin-templates"
import { renderPrintPdf } from "./render-print"
import { sampleBook } from "./fixtures"

/** Writes one sample PDF per template for eyeballing: PRINT_SAMPLES=<folder> npm test -- lib/print/sample */
it.runIf(process.env.PRINT_SAMPLES)("writes sample PDFs", async () => {
  for (const template of BUILTIN_TEMPLATES) {
    const { blob } = await renderPrintPdf(sampleBook(3, 14), {
      template,
      trimSizeId: "6x9",
      printer: "kdp",
      bleed: false,
      copyright: { text: "Copyright © 2026 A. N. Author\n\nAll rights reserved. No part of this book may be reproduced without permission.\n\nThis is a work of fiction." },
      resolveFile: (r) => path.resolve("public", r.replace(/^\//, "")),
    })
    writeFileSync(path.join(process.env.PRINT_SAMPLES!, `${template.id}.pdf`), new Uint8Array(await blob.arrayBuffer()))
  }
}, 300_000)
