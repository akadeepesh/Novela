"use client"

import { useRef, useState, useTransition } from "react"
import Link from "next/link"
import { useLiveQuery } from "dexie-react-hooks"
import { UploadSimpleIcon } from "@phosphor-icons/react/dist/ssr"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog"
import { deleteImportedTemplate, importTemplatePack, listTemplates, type TemplateEntry } from "@/lib/print/packs"
import { TemplateError } from "@/lib/print/template"

/** Settings → Templates: the print templates on this device, and importing packs. */
export function TemplatesPanel() {
  const templates = useLiveQuery(listTemplates, [])
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, startBusy] = useTransition()
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null)
  const [removing, setRemoving] = useState<TemplateEntry | null>(null)

  function onFile(file: File | undefined) {
    if (!file) return
    setMessage(null)
    startBusy(async () => {
      try {
        const pack = await importTemplatePack(file)
        setMessage({
          kind: "ok",
          text: `Imported ${pack.name}: ${pack.templates.map((t) => t.name).join(", ")}. Choose it on any book's Export page.`,
        })
      } catch (err) {
        setMessage({ kind: "error", text: err instanceof TemplateError ? err.message : "Couldn't import this pack." })
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Print templates</CardTitle>
        <CardDescription>
          How your printed book looks: fonts, chapter openings and page layout. Imported packs are stored
          on this device. Keep the pack file, as backups don&apos;t include templates.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
          {(templates ?? []).map((entry) => (
            <li key={entry.template.id} className="flex items-center gap-3 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-foreground">{entry.template.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {entry.source === "builtin" ? "Built in" : entry.packName}
                  {entry.template.description ? ` · ${entry.template.description}` : ""}
                </p>
              </div>
              {entry.source === "imported" ? (
                <Button size="sm" variant="ghost" onClick={() => setRemoving(entry)}>
                  Remove
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={inputRef}
            type="file"
            accept=".zip,application/zip"
            className="hidden"
            onChange={(e) => {
              onFile(e.target.files?.[0])
              e.target.value = ""
            }}
          />
          <Button size="sm" variant="outline" disabled={busy} onClick={() => inputRef.current?.click()}>
            <UploadSimpleIcon />
            {busy ? "Importing…" : "Import a template pack"}
          </Button>
          <Link href="/templates" className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
            Get more templates
          </Link>
        </div>
        {message ? (
          <p role={message.kind === "error" ? "alert" : "status"} className={message.kind === "error" ? "text-destructive" : "text-foreground"}>
            {message.text}
          </p>
        ) : null}
      </CardContent>
      <DeleteConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        itemName={removing?.template.name ?? ""}
        itemLabel="template"
        title="Remove template?"
        confirmLabel="Remove"
        pendingLabel="Removing…"
        description={
          <>
            “{removing?.template.name}” will be removed from this device. Books using it will print with
            Classic until you choose another or import the pack again.
          </>
        }
        onConfirm={() => {
          if (removing) void deleteImportedTemplate(removing.template.id)
          setRemoving(null)
        }}
      />
    </Card>
  )
}
