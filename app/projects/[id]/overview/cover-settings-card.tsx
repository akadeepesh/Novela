"use client"

import { useActionState, useRef, useState, useTransition } from "react"
import { TrashIcon, UploadSimpleIcon } from "@phosphor-icons/react/dist/ssr"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { cn } from "cn"
import { useImageUrl } from "@/lib/store/use-image-url"
import {
  uploadCoverAction,
  removeCoverAction,
  updateBackCoverBlurbAction,
  type CoverSide,
  type UploadCoverState,
  type UpdateBackCoverBlurbState,
} from "./actions"

const initialState: UploadCoverState = {}
const blurbInitialState: UpdateBackCoverBlurbState = {}

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"]
const ACCEPTED_EXT_LABEL = "PNG, JPEG, WEBP, or GIF"
const MAX_BYTES = 5 * 1024 * 1024

/**
 * A single front/back cover slot — the whole card is the dropzone (click
 * or drag a file anywhere on it) and, once a cover is set, the thumbnail
 * itself. Nothing lives outside it: no separate "Upload" button, no label
 * floating underneath (Book Settings redesign, per feedback on the old
 * two-piece layout).
 */
function CoverSlot({
  projectId,
  side,
  label,
  hint,
  url,
}: {
  projectId: string
  side: CoverSide
  label: string
  hint: string
  url?: string
}) {
  const boundUpload = uploadCoverAction.bind(null, projectId, side)
  const [state, formAction, uploading] = useActionState(boundUpload, initialState)
  const [removing, startRemove] = useTransition()
  const [dragOver, setDragOver] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // `url` is the stored reference and updates live once the image is saved;
  // a locally stored image is turned into an object URL here.
  const previewUrl = useImageUrl(url)
  const busy = uploading || removing
  const error = localError ?? state.error

  function submitFile(file: File) {
    setLocalError(null)
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setLocalError(`Use a ${ACCEPTED_EXT_LABEL} file.`)
      return
    }
    if (file.size > MAX_BYTES) {
      setLocalError("Keep it under 5MB.")
      return
    }
    const fd = new FormData()
    fd.set("file", file)
    formAction(fd)
  }

  function handleClick() {
    if (busy) return
    inputRef.current?.click()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (busy) return
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      handleClick()
    }
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    if (!busy) setDragOver(true)
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragOver(false)
    if (busy) return
    const file = e.dataTransfer.files?.[0]
    if (file) submitFile(file)
  }

  function handleRemove(e: React.MouseEvent) {
    e.stopPropagation()
    if (busy) return
    startRemove(async () => {
      await removeCoverAction(projectId, side)
    })
  }

  return (
    <div className="flex flex-1 flex-col gap-2">
      <div
        role="button"
        tabIndex={busy ? -1 : 0}
        aria-label={previewUrl ? `Replace ${label.toLowerCase()}` : `Upload ${label.toLowerCase()}`}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onDragOver={handleDragOver}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={cn(
          "group relative h-60 w-full cursor-pointer overflow-hidden rounded-xl border border-dashed border-border bg-muted/40 bg-cover bg-center transition-colors",
          "hover:border-ring/60 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
          dragOver && "border-ring bg-accent/40",
          previewUrl && "border-solid",
          busy && "pointer-events-none opacity-70"
        )}
        style={
          previewUrl
            ? {
                backgroundImage: `url(${previewUrl})`,
                backgroundSize: "contain",
                backgroundRepeat: "no-repeat",
              }
            : undefined
        }
      >
        {!previewUrl ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-4 text-center">
            <UploadSimpleIcon className="size-6 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">{label}</p>
            <p className="text-xs leading-tight text-muted-foreground">
              {dragOver ? "Drop to upload" : hint}
            </p>
          </div>
        ) : (
          <>
            {/* Always-on identifying pill — the only thing that stays
                visible outside hover, so front/back is still legible once
                a cover is set without needing a caption below the box. */}
            <span className="absolute top-2 left-2 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-xs">
              {label}
            </span>

            <div className="absolute inset-0 flex flex-col justify-end bg-linear-to-t from-black/75 via-black/10 to-transparent opacity-0 transition-opacity group-hover:opacity-100">
              <div className="flex items-center justify-between p-2">
                <span className="text-[11px] font-medium text-white">Replace</span>
                <button
                  type="button"
                  aria-label={`Remove ${label.toLowerCase()}`}
                  disabled={busy}
                  onClick={handleRemove}
                  className="rounded-full bg-black/40 p-1 text-white transition-colors hover:bg-black/60"
                >
                  <TrashIcon className="size-3.5" />
                </button>
              </div>
            </div>
          </>
        )}

        {busy ? (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50">
            <span className="text-[11px] font-medium text-foreground">
              {uploading ? "Uploading…" : "Removing…"}
            </span>
          </div>
        ) : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        name="file"
        accept={ACCEPTED_TYPES.join(",")}
        className="hidden"
        disabled={busy}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) submitFile(file)
          e.target.value = ""
        }}
      />

      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}

function BackCoverBlurb({ projectId, blurb }: { projectId: string; blurb?: string }) {
  const boundAction = updateBackCoverBlurbAction.bind(null, projectId)
  const [state, formAction, pending] = useActionState(boundAction, blurbInitialState)

  return (
    <div className="flex w-full flex-col gap-2">
      <Label htmlFor="blurb">Back-cover blurb</Label>
      <p className="text-xs text-muted-foreground">
        Optional. Shown on the back cover in Export — never displayed anywhere else if left blank.
      </p>
      <form action={formAction} className="flex flex-col gap-2">
        {state.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
        <Textarea
          id="blurb"
          name="blurb"
          rows={4}
          maxLength={600}
          placeholder="A line or two that would make someone want to read this."
          defaultValue={blurb}
        />
        <div className="flex items-center gap-3">
          <Button type="submit" size="sm" variant="outline" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
          {state.success ? <span className="text-xs text-muted-foreground">Saved.</span> : null}
        </div>
      </form>
    </div>
  )
}

export function CoverSettingsCard({
  projectId,
  coverFrontUrl,
  coverBackUrl,
  backCoverBlurb,
}: {
  projectId: string
  coverFrontUrl?: string
  coverBackUrl?: string
  backCoverBlurb?: string
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Cover</CardTitle>
        <CardDescription>
          Used in Read View and export. Leave either blank and a clean typeset cover is
          generated from your title and author name — the book never looks unfinished.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-8">
        <div className="flex flex-col gap-6 sm:flex-row">
          <CoverSlot
            projectId={projectId}
            side="front"
            label="Front cover"
            hint="Drag & drop or click — PNG, JPEG, WEBP, or GIF, up to 5MB"
            url={coverFrontUrl}
          />
          <CoverSlot
            projectId={projectId}
            side="back"
            label="Back cover"
            hint="Optional — shown as the final page in Read View"
            url={coverBackUrl}
          />
        </div>

        <BackCoverBlurb projectId={projectId} blurb={backCoverBlurb} />
      </CardContent>
    </Card>
  )
}
