"use client"

import { useMemo, useState } from "react"
import { FilePdfIcon, FileDocIcon, BookIcon, DownloadSimpleIcon } from "@phosphor-icons/react/dist/ssr"
import { cn } from "cn"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import type { SectionId } from "@/lib/project-config"

type Format = "pdf" | "epub" | "docx"

const FORMATS: { value: Format; label: string; description: string; icon: typeof FilePdfIcon }[] = [
  { value: "pdf", label: "PDF", description: "Fixed layout, ready to print or share as-is.", icon: FilePdfIcon },
  { value: "epub", label: "EPUB", description: "Reflowable — opens in Kindle, Apple Books, etc.", icon: BookIcon },
  { value: "docx", label: "Word (.docx)", description: "Editable — for agents, editors, or further edits.", icon: FileDocIcon },
]

export function ExportForm({
  projectId,
  projectTitle,
  defaultAuthorName,
  availableSections,
}: {
  projectId: string
  projectTitle: string
  defaultAuthorName?: string
  availableSections: { id: SectionId; label: string }[]
}) {
  const [format, setFormat] = useState<Format>("pdf")
  const [includeTitlePage, setIncludeTitlePage] = useState(true)
  const [includeTOC, setIncludeTOC] = useState(true)
  const [authorName, setAuthorName] = useState(defaultAuthorName ?? "")
  const [dedication, setDedication] = useState("")
  const [sections, setSections] = useState<SectionId[]>([])

  function toggleSection(id: SectionId, checked: boolean) {
    setSections((prev) => (checked ? [...prev, id] : prev.filter((s) => s !== id)))
  }

  const href = useMemo(() => {
    const params = new URLSearchParams()
    params.set("format", format)
    if (!includeTitlePage) params.set("titlePage", "off")
    if (!includeTOC) params.set("toc", "off")
    if (authorName.trim()) params.set("author", authorName.trim())
    if (dedication.trim()) params.set("dedication", dedication.trim())
    if (sections.length > 0) params.set("sections", sections.join(","))
    return `/api/projects/${projectId}/export?${params.toString()}`
  }, [projectId, format, includeTitlePage, includeTOC, authorName, dedication, sections])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Configure your export</CardTitle>
        <CardDescription>Choose a format and what to include — nothing here is saved.</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Label>Format</Label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {FORMATS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setFormat(f.value)}
                className={cn(
                  "flex flex-col items-start gap-1.5 rounded-lg border px-3 py-3 text-left transition-colors",
                  format === f.value
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/30"
                )}
              >
                <f.icon className={cn("size-5", format === f.value ? "text-primary" : "text-muted-foreground")} weight="duotone" />
                <span className="text-sm font-medium text-foreground">{f.label}</span>
                <span className="text-xs text-muted-foreground">{f.description}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Label>Front matter</Label>
          <label className="flex cursor-pointer items-center gap-2.5">
            <Checkbox checked={includeTitlePage} onCheckedChange={(c) => setIncludeTitlePage(c === true)} />
            <span className="text-sm text-foreground">Title page</span>
          </label>
          {includeTitlePage ? (
            <div className="ml-6 flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="authorName" className="text-xs text-muted-foreground">
                  Author name
                </Label>
                <Input
                  id="authorName"
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  placeholder={projectTitle}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="dedication" className="text-xs text-muted-foreground">
                  Dedication (optional)
                </Label>
                <Textarea
                  id="dedication"
                  rows={2}
                  value={dedication}
                  onChange={(e) => setDedication(e.target.value)}
                  placeholder="For anyone who ever finished a first draft."
                />
              </div>
            </div>
          ) : null}

          <label className="flex cursor-pointer items-center gap-2.5">
            <Checkbox checked={includeTOC} onCheckedChange={(c) => setIncludeTOC(c === true)} />
            <span className="text-sm text-foreground">Table of contents</span>
          </label>
        </div>

        {availableSections.length > 0 ? (
          <div className="flex flex-col gap-2">
            <Label>Also include</Label>
            <p className="text-xs text-muted-foreground">
              Off by default — most exports are just the manuscript.
            </p>
            <div className="flex flex-col gap-2">
              {availableSections.map((s) => (
                <label key={s.id} className="flex cursor-pointer items-center gap-2.5">
                  <Checkbox
                    checked={sections.includes(s.id)}
                    onCheckedChange={(c) => toggleSection(s.id, c === true)}
                  />
                  <span className="text-sm text-foreground">{s.label}</span>
                </label>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>

      <CardFooter className="mt-2 border-t pt-5">
        <Button size="lg" render={<a href={href} />} nativeButton={false}>
          <DownloadSimpleIcon />
          Download {FORMATS.find((f) => f.value === format)?.label}
        </Button>
      </CardFooter>
    </Card>
  )
}
