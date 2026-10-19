"use client"

import { useMemo, useOptimistic, useRef, useState, useTransition } from "react"
import { cn } from "cn"
import { ImageIcon, TrashIcon } from "@phosphor-icons/react/dist/ssr"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card"
import { BoundedNumberInput, DebouncedInput } from "@/components/ui/committed-input"
import { createActionQueue } from "@/lib/action-queue"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  BACKGROUND_PRESETS,
  CUSTOM_BACKGROUND_ID,
  LINE_WIDTHS,
  type ManuscriptSettings,
} from "@/lib/manuscript-config"
import {
  updateManuscriptSettingsAction,
  uploadManuscriptBackgroundAction,
  removeManuscriptBackgroundAction,
  type ManuscriptSettingsInput,
} from "../chapters/[chapterId]/actions"

export function ManuscriptSettingsCard({
  projectId,
  settings,
}: {
  projectId: string
  settings: ManuscriptSettings
}) {
  const [optimisticSettings, setOptimisticSettings] = useOptimistic(settings)
  const [isPending, startTransition] = useTransition()
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [backgroundBusy, setBackgroundBusy] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [saveFailed, setSaveFailed] = useState(false)
  // One settings save at a time, in order (see lib/action-queue.ts).
  const enqueue = useMemo(() => createActionQueue(), [])

  function patch(update: Partial<ManuscriptSettings>) {
    // setOptimisticSettings must run while a transition is pending — as the
    // first synchronous line inside startTransition's callback, not before
    // it. Calling it beforehand (the previous shape here) is what a plain
    // onClick handler can't satisfy, hence React's "outside a
    // transition/action" warning on every one of these settings.
    startTransition(async () => {
      setOptimisticSettings({ ...optimisticSettings, ...update })
      const result = await enqueue(() =>
        updateManuscriptSettingsAction(projectId, update as ManuscriptSettingsInput)
      ).catch(() => ({ ok: false }))
      setSaveFailed(!result.ok)
    })
  }

  function handleFileSelected(file: File | undefined) {
    if (!file) return
    setUploadError(null)
    setBackgroundBusy(true)
    startTransition(async () => {
      const formData = new FormData()
      formData.set("file", file)
      const result = await uploadManuscriptBackgroundAction(projectId, {}, formData)
      setBackgroundBusy(false)
      if (result.error) {
        setUploadError(result.error)
        return
      }
      setOptimisticSettings({
        ...optimisticSettings,
        background: CUSTOM_BACKGROUND_ID,
        backgroundImageUrl: result.url ?? optimisticSettings.backgroundImageUrl,
      })
    })
  }

  function handleRemoveCustomBackground() {
    setUploadError(null)
    setBackgroundBusy(true)
    startTransition(async () => {
      setOptimisticSettings({ ...optimisticSettings, background: "paper", backgroundImageUrl: "" })
      await removeManuscriptBackgroundAction(projectId)
      setBackgroundBusy(false)
    })
  }

  const customBackgroundUrl = optimisticSettings.backgroundImageUrl
  const isCustomBackground = optimisticSettings.background === CUSTOM_BACKGROUND_ID

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Manuscript appearance</CardTitle>
        <CardDescription>
          Background, typography, and header/footer for the writing surface. Applies to every chapter.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Label>Background</Label>
          <div className="flex flex-wrap gap-2">
            {BACKGROUND_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => patch({ background: preset.id })}
                disabled={isPending}
                className={cn(
                  "flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs transition-colors disabled:opacity-50",
                  optimisticSettings.background === preset.id
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

            {/* Custom is a swatch too, but its "color" is whatever image is
                uploaded (or a placeholder icon before one exists) — clicking
                it either selects the existing custom image or opens the
                file picker to set one for the first time. */}
            <button
              type="button"
              onClick={() => {
                if (customBackgroundUrl) {
                  patch({ background: CUSTOM_BACKGROUND_ID })
                } else {
                  fileInputRef.current?.click()
                }
              }}
              disabled={backgroundBusy}
              className={cn(
                "flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs transition-colors disabled:opacity-50",
                isCustomBackground
                  ? "border-primary text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              <span
                className="flex size-3 items-center justify-center rounded-full border border-black/10 bg-cover bg-center"
                style={customBackgroundUrl ? { backgroundImage: `url(${customBackgroundUrl})` } : undefined}
              >
                {!customBackgroundUrl ? <ImageIcon className="size-2.5 text-muted-foreground" /> : null}
              </span>
              {backgroundBusy && !customBackgroundUrl ? "Uploading…" : "Custom image"}
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            disabled={backgroundBusy}
            onChange={(e) => {
              handleFileSelected(e.target.files?.[0])
              e.target.value = ""
            }}
          />

          {uploadError ? <p className="text-xs text-destructive">{uploadError}</p> : null}

          {customBackgroundUrl ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={backgroundBusy}
                className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline disabled:opacity-50"
              >
                Replace image
              </button>
              <span className="text-muted-foreground/50">·</span>
              <button
                type="button"
                onClick={handleRemoveCustomBackground}
                disabled={backgroundBusy}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive disabled:opacity-50"
              >
                <TrashIcon className="size-3" />
                Remove
              </button>
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fontSize">Font size</Label>
            <BoundedNumberInput
              id="fontSize"
              min={14}
              max={28}
              value={optimisticSettings.fontSize}
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
              value={optimisticSettings.lineHeight}
              onValidChange={(lineHeight) => patch({ lineHeight })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Line width</Label>
            <div className="flex gap-1">
              {LINE_WIDTHS.map((width) => (
                <button
                  key={width}
                  type="button"
                  onClick={() => patch({ lineWidth: width })}
                  disabled={isPending}
                  className={cn(
                    "flex-1 rounded-md border px-2 py-1.5 text-xs capitalize transition-colors disabled:opacity-50",
                    optimisticSettings.lineWidth === width
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
                checked={optimisticSettings.showHeader}
                onCheckedChange={(checked) => patch({ showHeader: checked === true })}
                disabled={isPending}
              />
              <span className="text-sm text-foreground">Show running header</span>
            </label>
            {optimisticSettings.showHeader ? (
              <DebouncedInput
                placeholder="Defaults to the chapter title"
                value={optimisticSettings.headerText}
                maxLength={120}
                onCommit={(headerText) => patch({ headerText })}
              />
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <label className="flex cursor-pointer items-center gap-2">
              <Checkbox
                checked={optimisticSettings.showFooter}
                onCheckedChange={(checked) => patch({ showFooter: checked === true })}
                disabled={isPending}
              />
              <span className="text-sm text-foreground">Show footer</span>
            </label>
            {optimisticSettings.showFooter ? (
              <DebouncedInput
                placeholder="e.g. your name, or a page note"
                value={optimisticSettings.footerText}
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
      </CardContent>
    </Card>
  )
}
