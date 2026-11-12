import { getProject } from "@/lib/store/projects"
import type { ExportOptions } from "./build-document"

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

/**
 * Builds an export file entirely in the browser and starts the download.
 * The renderers are loaded on demand: the PDF one in particular is large.
 */
export async function downloadExport(
  projectId: string,
  format: ExportFormat,
  options: ExportOptions & { authorName?: string }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const project = await getProject(projectId)
  if (!project) return { ok: false, error: "Couldn't find this project." }

  const { buildExportDocument } = await import("./build-document")
  const doc = await buildExportDocument(
    { ...project, authorName: options.authorName?.trim().slice(0, 120) || project.authorName },
    options
  )

  let blob: Blob
  if (format === "pdf") blob = await (await import("./render-pdf")).renderPdf(doc)
  else if (format === "epub") blob = await (await import("./render-epub")).renderEpub(doc)
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
  return { ok: true }
}
