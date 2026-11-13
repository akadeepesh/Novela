"use client"

import { useState, useTransition } from "react"
import { BookOpenIcon } from "@phosphor-icons/react/dist/ssr"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { coverSize, formatInches, MIN_PAGES, type Paper } from "@/lib/print/specs"
import { DEFAULT_PRINT_SETTINGS } from "@/lib/print/settings"
import { getAssetBlob, resolveImageToDataUrl } from "@/lib/store/assets"
import { updatePrintSettings, type SerializedProject } from "@/lib/store/projects"
import { saveBlob, slugify } from "@/lib/backup/download"

const PRINT_DPI = 300

/** Pixels per inch an image would print at across `widthIn`, or null if it can't be read. */
async function imageDpi(ref: string | undefined, widthIn: number): Promise<number | null> {
  const blob = await getAssetBlob(ref)
  if (!blob || typeof createImageBitmap === "undefined") return null
  try {
    const bitmap = await createImageBitmap(blob)
    const dpi = bitmap.width / widthIn
    bitmap.close()
    return dpi
  } catch {
    return null
  }
}

/**
 * The paperback cover: one PDF with back, spine and front at the printer's
 * exact size. The spine width comes from the page count of the last print
 * PDF (editable), and the paper chosen above.
 */
export function CoverCard({ project }: { project: SerializedProject }) {
  const settings = { ...DEFAULT_PRINT_SETTINGS, ...project.print }
  const [pages, setPages] = useState<string>(settings.lastPageCount ? String(settings.lastPageCount) : "")
  // A new print export updates the page count; follow it.
  const [seenCount, setSeenCount] = useState(settings.lastPageCount)
  if (settings.lastPageCount !== seenCount) {
    setSeenCount(settings.lastPageCount)
    if (settings.lastPageCount) setPages(String(settings.lastPageCount))
  }
  const [busy, startBusy] = useTransition()
  const [messages, setMessages] = useState<string[]>([])
  const color = settings.coverColor ?? "#1f2a36"
  const pageCount = Number(pages)
  const valid = Number.isInteger(pageCount) && pageCount >= MIN_PAGES && pageCount <= 2000
  const size = valid ? coverSize({ trimSizeId: project.exportTrimSize, pageCount, paper: settings.paper as Paper }) : null

  function download() {
    if (!valid || !size) return
    setMessages([])
    startBusy(async () => {
      const notes: string[] = []
      try {
        const [{ renderCoverPdf }, { getTemplate, templateFileResolver }, { CLASSIC }] = await Promise.all([
          import("@/lib/print/render-cover"),
          import("@/lib/print/packs"),
          import("@/lib/print/builtin-templates"),
        ])
        const template = (await getTemplate(settings.templateId)) ?? CLASSIC
        const { resolveFile, dispose } = await templateFileResolver(template)
        for (const [label, ref] of [["front", project.coverFrontUrl], ["back", project.coverBackUrl]] as const) {
          const dpi = await imageDpi(ref, size.trim.widthIn + size.bleedIn)
          if (dpi !== null && dpi < PRINT_DPI) {
            notes.push(`The ${label} cover image is about ${Math.round(dpi)} DPI; printers want ${PRINT_DPI}. It may print soft.`)
          }
        }
        try {
          const blob = await renderCoverPdf({
            title: project.title,
            author: project.authorName,
            blurb: project.blurb,
            frontImage: await resolveImageToDataUrl(project.coverFrontUrl),
            backImage: await resolveImageToDataUrl(project.coverBackUrl),
            template,
            trimSizeId: project.exportTrimSize,
            pageCount,
            paper: settings.paper as Paper,
            background: color,
            resolveFile,
          })
          saveBlob(blob, `${slugify(project.title)}-cover.pdf`)
          await updatePrintSettings(project.id, { lastPageCount: pageCount }, DEFAULT_PRINT_SETTINGS)
        } finally {
          dispose()
        }
      } catch (err) {
        console.error("cover failed", err)
        notes.push("Couldn't make the cover. Please try again.")
      }
      setMessages(notes)
    })
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="text-base">Paperback cover</CardTitle>
        <CardDescription>
          One PDF with the back, spine and front, sized for your page count and paper. Uses your cover
          images from Book Settings, or sets the title in type if there are none. The barcode corner on the
          back is left clear.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="coverPages" className="text-xs text-muted-foreground">Page count</Label>
            <Input
              id="coverPages"
              inputMode="numeric"
              value={pages}
              onChange={(e) => setPages(e.target.value.replace(/\D/g, ""))}
              placeholder="Export the PDF first"
              className="w-40"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="coverColor" className="text-xs text-muted-foreground">Background</Label>
            <input
              id="coverColor"
              type="color"
              value={color}
              onChange={(e) => void updatePrintSettings(project.id, { coverColor: e.target.value }, DEFAULT_PRINT_SETTINGS)}
              className="h-9 w-14 cursor-pointer rounded-md border border-input bg-transparent"
            />
          </div>
          <Button variant="outline" disabled={!valid || busy} onClick={download}>
            <BookOpenIcon />
            {busy ? "Preparing…" : "Download cover PDF"}
          </Button>
        </div>
        {size ? (
          <p className="text-muted-foreground">
            Cover {formatInches(size.widthIn)} × {formatInches(size.heightIn)}, spine {formatInches(size.spineIn)}.
            {size.spineText ? "" : " Under 80 pages, so no spine text."}
          </p>
        ) : pages ? (
          <p className="text-destructive">Enter a page count of at least {MIN_PAGES}.</p>
        ) : null}
        {messages.map((m) => (
          <p key={m} className="text-destructive">
            {m}
          </p>
        ))}
      </CardContent>
    </Card>
  )
}
