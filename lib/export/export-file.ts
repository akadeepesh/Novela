import { getProject } from "@/lib/store/projects"
import type { ExportOptions } from "./build-document"
import type { PrintReport } from "@/lib/print/render-print"

export type ExportFormat = "pdf" | "epub" | "docx"

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "manuscript"
  )
}

export type ExportResult =
  | { ok: true; print?: { report: PrintReport; missingGlyphs: string[]; templateName: string } }
  | { ok: false; error: string }

/**
 * Builds an export file entirely in the browser and starts the download.
 * PDF is the print-ready interior (template, mirrored margins, embedded
 * fonts) and reports its page count and any problems. The renderers load on
 * demand: the PDF one in particular is large.
 */
export async function downloadExport(
  projectId: string,
  format: ExportFormat,
  options: ExportOptions & { authorName?: string },
  onProgress?: (step: string) => void
): Promise<ExportResult> {
  const project = await getProject(projectId)
  if (!project) return { ok: false, error: "Couldn't find this project." }

  const { buildExportDocument } = await import("./build-document")
  const authorName = options.authorName?.trim().slice(0, 120) || project.authorName
  const doc = await buildExportDocument({ ...project, authorName }, options)

  let blob: Blob
  let print: Extract<ExportResult, { ok: true }>["print"]
  if (format === "pdf") {
    const [{ renderPrintPdf }, { getTemplate, templateFileResolver }, { findMissingGlyphs }, { DEFAULT_PRINT_SETTINGS, defaultCopyrightText }, { CLASSIC }] =
      await Promise.all([
        import("@/lib/print/render-print"),
        import("@/lib/print/packs"),
        import("@/lib/print/glyphs"),
        import("@/lib/print/settings"),
        import("@/lib/print/builtin-templates"),
      ])
    const settings = { ...DEFAULT_PRINT_SETTINGS, ...project.print }
    const template = (await getTemplate(settings.templateId)) ?? CLASSIC
    const copyright = settings.copyrightText.trim() || defaultCopyrightText(authorName)
    const { resolveFile, dispose } = await templateFileResolver(template)
    try {
      onProgress?.("Checking fonts…")
      const missingGlyphs = await findMissingGlyphs(
        doc,
        template,
        async (ref) => (await fetch(resolveFile(ref))).arrayBuffer(),
        doc.includeTitlePage ? [copyright] : []
      )
      const result = await renderPrintPdf(doc, {
        template,
        trimSizeId: project.exportTrimSize,
        printer: settings.printer,
        bleed: settings.bleed,
        copyright: { text: copyright },
        resolveFile,
        onProgress,
      })
      blob = result.blob
      print = { report: result.report, missingGlyphs, templateName: template.name }
      const { updatePrintSettings } = await import("@/lib/store/projects")
      await updatePrintSettings(projectId, { lastPageCount: result.report.pageCount }, DEFAULT_PRINT_SETTINGS)
    } finally {
      dispose()
    }
  } else if (format === "epub") blob = await (await import("./render-epub")).renderEpub(doc)
  else blob = await (await import("./render-docx")).renderDocx(doc)

  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `${slugify(project.title)}.${format}`
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Give the browser a moment to start the download before freeing the file.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return { ok: true, print }
}
