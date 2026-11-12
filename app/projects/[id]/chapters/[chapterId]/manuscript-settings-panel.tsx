"use client"

import { useState } from "react"
import { XIcon } from "@phosphor-icons/react/dist/ssr"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { BoundedNumberInput, DebouncedInput } from "@/components/ui/committed-input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import type { ActionQueue } from "@/lib/action-queue"
import { useImageUrl } from "@/lib/store/use-image-url"
import {
  BACKGROUND_PRESETS,
  CUSTOM_BACKGROUND_ID,
  FONT_FAMILIES,
  FONT_FAMILY_CSS,
  FONT_FAMILY_LABEL,
  LINE_WIDTHS,
  type ManuscriptSettings,
} from "@/lib/manuscript-config"
import { updateManuscriptSettingsAction, type ManuscriptSettingsInput } from "./actions"

export function ManuscriptSettingsPanel({
  projectId,
  settings,
  onChange,
  onClose,
  enqueue,
}: {
  projectId: string
  settings: ManuscriptSettings
  onChange: (settings: ManuscriptSettings) => void
  onClose: () => void
  // Shared with the editor's own title/content saves so a settings change
  // and an in-progress autosave are never both in flight at once.
  enqueue: ActionQueue
}) {
  const [saveFailed, setSaveFailed] = useState(false)
  const customBackgroundUrl = useImageUrl(settings.backgroundImageUrl)

  function patch(update: Partial<ManuscriptSettings>) {
    const next = { ...settings, ...update }
    onChange(next)
    enqueue(() => updateManuscriptSettingsAction(projectId, update as ManuscriptSettingsInput))
      .catch(() => ({ ok: false }))
      .then((result) => setSaveFailed(!result.ok))
  }

  return (
    <div className="border-b border-border bg-muted/30 px-6 py-4">
      <div className="mx-auto flex max-w-2xl flex-col gap-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-foreground">Page appearance</p>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Close"
          >
            <XIcon className="size-4" />
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <Label>Background</Label>
          <div className="flex flex-wrap gap-2">
            {BACKGROUND_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => patch({ background: preset.id })}
                className={cn(
                  "flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs transition-colors",
                  settings.background === preset.id
                    ? "border-primary text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                <span
                  className="size-3 rounded-full border border-black/10"
                  style={{ background: preset.swatch }}
                />
                {preset.label}
              </button>
            ))}

            {/* Uploading a custom image only happens in Book Settings (the
                single source of truth for this) — here it's just selectable
                once it exists, same as any other preset. */}
            {settings.backgroundImageUrl ? (
              <button
                type="button"
                onClick={() => patch({ background: CUSTOM_BACKGROUND_ID })}
                className={cn(
                  "flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs transition-colors",
                  settings.background === CUSTOM_BACKGROUND_ID
                    ? "border-primary text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                <span
                  className="size-3 rounded-full border border-black/10 bg-cover bg-center"
                  style={customBackgroundUrl ? { backgroundImage: `url(${customBackgroundUrl})` } : undefined}
                />
                Custom
              </button>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fontSize">Font size</Label>
            <BoundedNumberInput
              id="fontSize"
              min={14}
              max={28}
              value={settings.fontSize}
              onValidChange={(fontSize) => patch({ fontSize })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lineHeight">Line height</Label>
            <BoundedNumberInput
              id="lineHeight"
              step={0.05}
              min={1.3}
              max={2.2}
              value={settings.lineHeight}
              onValidChange={(lineHeight) => patch({ lineHeight })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Typeface</Label>
            <div className="flex gap-1">
              {FONT_FAMILIES.map((family) => (
                <button
                  key={family}
                  type="button"
                  onClick={() => patch({ fontFamily: family })}
                  style={{ fontFamily: FONT_FAMILY_CSS[family] }}
                  className={cn(
                    "flex-1 rounded-md border px-2 py-1.5 text-xs transition-colors",
                    settings.fontFamily === family
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  {FONT_FAMILY_LABEL[family]}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Line width</Label>
            <div className="flex gap-1">
              {LINE_WIDTHS.map((width) => (
                <button
                  key={width}
                  type="button"
                  onClick={() => patch({ lineWidth: width })}
                  className={cn(
                    "flex-1 rounded-md border px-2 py-1.5 text-xs capitalize transition-colors",
                    settings.lineWidth === width
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  {width}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label className="flex cursor-pointer items-center gap-2">
              <Checkbox
                checked={settings.showHeader}
                onCheckedChange={(checked) => patch({ showHeader: checked === true })}
              />
              <span className="text-sm text-foreground">Show running header</span>
            </label>
            {settings.showHeader ? (
              <DebouncedInput
                placeholder="Defaults to the chapter title"
                value={settings.headerText}
                maxLength={120}
                onCommit={(headerText) => patch({ headerText })}
              />
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <label className="flex cursor-pointer items-center gap-2">
              <Checkbox
                checked={settings.showFooter}
                onCheckedChange={(checked) => patch({ showFooter: checked === true })}
              />
              <span className="text-sm text-foreground">Show footer</span>
            </label>
            {settings.showFooter ? (
              <DebouncedInput
                placeholder="e.g. your name, or a page note"
                value={settings.footerText}
                maxLength={120}
                onCommit={(footerText) => patch({ footerText })}
              />
            ) : null}
          </div>
        </div>

        {saveFailed ? (
          <p role="alert" className="text-xs text-destructive">
            Couldn&apos;t save your last change. It still applies here; change it again to retry.
          </p>
        ) : null}

        <p className="text-xs text-muted-foreground">
          Applies to every {" "}
          <span className="italic">chapter</span> in this project. Header/footer become real page
          furniture in exported files (Part 5).
        </p>

        <div>
          <Button type="button" size="sm" variant="outline" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  )
}
