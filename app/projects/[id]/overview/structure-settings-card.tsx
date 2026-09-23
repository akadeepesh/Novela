"use client"

import { useState } from "react"
import { cn } from "cn"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CHAPTER_NUMBERING_STYLES } from "@/lib/chapter-numbering"
import { TRIM_SIZES } from "@/lib/export-config"
import type { SerializedProject } from "@/lib/projects"
import { CHAPTER_LABEL_SINGULAR } from "@/lib/project-config"
import { updateStructureSettingsAction, type StructureInput } from "./actions"

type Structure = {
  chapterNumberingStyle: SerializedProject["chapterNumberingStyle"]
  chapterNumberingPrefix: string
  exportTrimSize: SerializedProject["exportTrimSize"]
}

function numberingExample(structure: Structure, singular: string): string {
  switch (structure.chapterNumberingStyle) {
    case "custom":
      return `${structure.chapterNumberingPrefix.trim() || singular} 1`
    case "word":
      return `${singular} One`
    case "none":
      return "(no number)"
    case "numeral":
    default:
      return "1"
  }
}

export function StructureSettingsCard({ project }: { project: SerializedProject }) {
  // Plain local state, fired-and-forgotten to the server, deliberately NOT
  // useOptimistic — this is the same pattern the in-editor quick popover
  // already uses safely: local state can't "snap back" the way an
  // optimistic value does when its base prop hasn't caught up yet.
  const [structure, setStructure] = useState<Structure>({
    chapterNumberingStyle: project.chapterNumberingStyle,
    chapterNumberingPrefix: project.chapterNumberingPrefix ?? "",
    exportTrimSize: project.exportTrimSize,
  })

  function patch(update: Partial<Structure>) {
    setStructure((prev) => ({ ...prev, ...update }))
    updateStructureSettingsAction(project.id, update as StructureInput).catch(() => {
      // Best-effort — the setting still applies locally for this session.
    })
  }

  const singular = CHAPTER_LABEL_SINGULAR[project.type]
  const trim = TRIM_SIZES.find((t) => t.id === structure.exportTrimSize) ?? TRIM_SIZES[0]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Structure</CardTitle>
        <CardDescription>
          How {singular.toLowerCase()}s are numbered, and the page size Export starts from.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Label>{singular} numbering</Label>
          <div className="flex flex-wrap gap-2">
            {CHAPTER_NUMBERING_STYLES.map((style) => (
              <button
                key={style.id}
                type="button"
                onClick={() => patch({ chapterNumberingStyle: style.id })}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs transition-colors",
                  structure.chapterNumberingStyle === style.id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                {style.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            e.g. &ldquo;{numberingExample(structure, singular)}&rdquo;
          </p>

          {structure.chapterNumberingStyle === "custom" ? (
            <div className="flex max-w-xs flex-col gap-1.5 pt-1">
              <Label htmlFor="chapterPrefix" className="text-xs text-muted-foreground">
                Prefix
              </Label>
              <Input
                id="chapterPrefix"
                placeholder={singular}
                value={structure.chapterNumberingPrefix}
                onChange={(e) => patch({ chapterNumberingPrefix: e.target.value })}
                maxLength={40}
              />
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <Label>Export trim size</Label>
          <p className="text-xs text-muted-foreground">
            Applies to PDF exports. EPUB reflows and Word always uses standard Letter — trim size
            only matters for a fixed page layout.
          </p>
          <div className="flex flex-wrap items-start gap-3 pt-1">
            {TRIM_SIZES.map((size) => (
              <button
                key={size.id}
                type="button"
                onClick={() => patch({ exportTrimSize: size.id })}
                className={cn(
                  "flex w-28 flex-col items-center gap-1.5 rounded-lg border px-2 py-2.5 text-center transition-colors",
                  structure.exportTrimSize === size.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/30"
                )}
              >
                <span
                  className={cn(
                    "rounded-sm border",
                    structure.exportTrimSize === size.id
                      ? "border-primary/60 bg-primary/10"
                      : "border-muted-foreground/40 bg-muted"
                  )}
                  style={{
                    width: `${(size.widthIn / 11) * 56}px`,
                    aspectRatio: `${size.widthIn} / ${size.heightIn}`,
                  }}
                />
                <span className="text-xs font-medium text-foreground">{size.label}</span>
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{trim.sublabel}</p>
        </div>
      </CardContent>
    </Card>
  )
}
