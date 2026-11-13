"use client"

import { useState } from "react"
import Link from "next/link"
import { useLiveQuery } from "dexie-react-hooks"
import { cn } from "cn"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { getTrimSize } from "@/lib/export-config"
import { listTemplates } from "@/lib/print/packs"
import { DEFAULT_PRINT_SETTINGS, defaultCopyrightText } from "@/lib/print/settings"
import { PAPERS, PRINTERS, coverSize, formatInches, spineWidthIn, type Paper, type Printer } from "@/lib/print/specs"
import type { PrintReport } from "@/lib/print/render-print"
import { updatePrintSettings, type SerializedProject } from "@/lib/store/projects"
import type { PrintSettings } from "@/lib/store/db"

/** Print choices for the PDF: template, printer, paper, bleed and the copyright page. Saved per book. */
export function PrintOptions({ project, authorName, showCopyright }: { project: SerializedProject; authorName: string; showCopyright: boolean }) {
  const templates = useLiveQuery(listTemplates, [])
  const settings: PrintSettings = { ...DEFAULT_PRINT_SETTINGS, ...project.print }
  const [copyright, setCopyright] = useState<string | null>(null)
  const save = (patch: Partial<PrintSettings>) => void updatePrintSettings(project.id, patch, DEFAULT_PRINT_SETTINGS)
  const trim = getTrimSize(project.exportTrimSize)
  const copyrightValue = copyright ?? (settings.copyrightText || defaultCopyrightText(authorName))

  return (
    <div className="flex flex-col gap-5 rounded-lg border border-border p-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <Label>Template</Label>
          <Link href="/templates" className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
            More templates
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {(templates ?? []).map(({ template, source, packName }) => (
            <button
              key={template.id}
              type="button"
              onClick={() => save({ templateId: template.id })}
              className={cn(
                "flex flex-col items-start gap-1 rounded-lg border px-3 py-2.5 text-left transition-colors",
                settings.templateId === template.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
              )}
            >
              <span className="text-sm font-medium text-foreground">{template.name}</span>
              <span className="line-clamp-2 text-xs text-muted-foreground">
                {source === "imported" ? `${packName} · ` : ""}
                {template.description}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">Page size</Label>
          <p className="text-sm text-foreground">
            {trim.label}{" "}
            <Link href={`/projects/${project.id}/overview`} className="text-xs text-muted-foreground underline-offset-2 hover:underline">
              Change
            </Link>
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="printer" className="text-xs text-muted-foreground">Printer</Label>
          <select
            id="printer"
            value={settings.printer}
            onChange={(e) => save({ printer: e.target.value as Printer })}
            className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
          >
            {PRINTERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="paper" className="text-xs text-muted-foreground">Paper (for the spine)</Label>
          <select
            id="paper"
            value={settings.paper}
            onChange={(e) => save({ paper: e.target.value as Paper })}
            className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
          >
            {PAPERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <label className="flex cursor-pointer items-start gap-2.5">
        <Checkbox checked={settings.bleed} onCheckedChange={(c) => save({ bleed: c === true })} className="mt-0.5" />
        <span className="text-sm text-foreground">
          Bleed
          <span className="block text-xs text-muted-foreground">
            Only if pictures run to the edge of the page. Choose the same option when you upload.
          </span>
        </span>
      </label>

      {showCopyright ? (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between">
            <Label htmlFor="copyright" className="text-xs text-muted-foreground">
              Copyright page (back of the title page). Add your ISBN here once you have one.
            </Label>
            {settings.copyrightText ? (
              <button
                type="button"
                onClick={() => {
                  setCopyright(null)
                  save({ copyrightText: "" })
                }}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Reset
              </button>
            ) : null}
          </div>
          <Textarea
            id="copyright"
            rows={6}
            value={copyrightValue}
            onChange={(e) => setCopyright(e.target.value)}
            onBlur={() => {
              if (copyright !== null) save({ copyrightText: copyright === defaultCopyrightText(authorName) ? "" : copyright })
            }}
          />
        </div>
      ) : null}
    </div>
  )
}

/** What the printer needs to know, after a PDF is made: pages, margins, spine and cover size. */
export function PrintSummary({
  report,
  missingGlyphs,
  templateName,
  project,
}: {
  report: PrintReport
  missingGlyphs: string[]
  templateName: string
  project: SerializedProject
}) {
  const paper = (project.print?.paper ?? DEFAULT_PRINT_SETTINGS.paper) as Paper
  const cover = coverSize({ trimSizeId: project.exportTrimSize, pageCount: report.pageCount, paper })
  const m = report.geometry.margins
  const rows: [string, string][] = [
    ["Template", templateName],
    ["Pages", String(report.pageCount)],
    ["Trim size", `${formatInches(report.geometry.trim.widthIn)} × ${formatInches(report.geometry.trim.heightIn)}${report.geometry.bleed ? " (with bleed)" : ""}`],
    ["Margins", `inside ${formatInches(m.inside)}, outside ${formatInches(m.outside)}, top ${formatInches(m.top)}, bottom ${formatInches(m.bottom)}`],
    ["Spine width", formatInches(spineWidthIn(report.pageCount, paper))],
    ["Full cover size", `${formatInches(cover.widthIn)} × ${formatInches(cover.heightIn)} (incl. ${formatInches(cover.bleedIn)} bleed)`],
  ]
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-4 text-sm">
      <p className="font-medium text-foreground">Your print PDF is ready</p>
      {report.warnings.length > 0 || missingGlyphs.length > 0 ? (
        <ul className="flex flex-col gap-1 text-destructive">
          {report.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
          {missingGlyphs.length > 0 ? (
            <li>
              The {templateName} font has no shape for these characters, so they would print blank:{" "}
              <span className="font-mono">{missingGlyphs.join(" ")}</span>. Choose another template, or change the text.
            </li>
          ) : null}
        </ul>
      ) : null}
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="text-foreground">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-muted-foreground">
        {cover.spineText
          ? "Spine text is allowed at this length."
          : "Under 80 pages, KDP doesn't allow text on the spine."}{" "}
        Upload the PDF as your interior and check it in the printer&apos;s previewer before ordering.
      </p>
    </div>
  )
}
