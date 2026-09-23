"use client"

import { useActionState, useRef, useTransition } from "react"
import { ImageIcon, TrashIcon, UploadSimpleIcon } from "@phosphor-icons/react/dist/ssr"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { cn } from "cn"
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
  const inputRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLFormElement>(null)

  // Optimistic-enough: the freshly uploaded URL (from action state) wins
  // over the server-rendered prop until the page next revalidates, so the
  // preview updates the moment the upload finishes rather than waiting on
  // a full round trip back through the parent.
  const previewUrl = state.url ?? url
  const busy = uploading || removing

  return (
    <div className="flex flex-col gap-2">
      <div
        className={cn(
          "relative aspect-[2/3] w-32 overflow-hidden rounded-md border border-border bg-muted bg-cover bg-center",
          busy && "opacity-60"
        )}
        style={previewUrl ? { backgroundImage: `url(${previewUrl})` } : undefined}
      >
        {!previewUrl ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 px-2 text-center text-muted-foreground">
            <ImageIcon className="size-5" />
            <span className="text-[11px] leading-tight">No cover — falls back to a typeset cover</span>
          </div>
        ) : null}
      </div>

      <p className="text-sm font-medium text-foreground">{label}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>

      {state.error ? <p className="text-xs text-destructive">{state.error}</p> : null}

      <form ref={formRef} action={formAction}>
        <input
          ref={inputRef}
          type="file"
          name="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          disabled={busy}
          onChange={() => formRef.current?.requestSubmit()}
        />
      </form>

      <div className="flex gap-1.5">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          <UploadSimpleIcon />
          {uploading ? "Uploading…" : previewUrl ? "Replace" : "Upload"}
        </Button>
        {previewUrl ? (
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            disabled={busy}
            aria-label={`Remove ${label.toLowerCase()}`}
            onClick={() =>
              startRemove(async () => {
                await removeCoverAction(projectId, side)
              })
            }
          >
            <TrashIcon />
          </Button>
        ) : null}
      </div>
    </div>
  )
}

function BackCoverBlurb({ projectId, blurb }: { projectId: string; blurb?: string }) {
  const boundAction = updateBackCoverBlurbAction.bind(null, projectId)
  const [state, formAction, pending] = useActionState(boundAction, blurbInitialState)

  return (
    <div className="flex w-full max-w-md flex-col gap-2">
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
        <div className="flex flex-wrap gap-8">
          <CoverSlot
            projectId={projectId}
            side="front"
            label="Front cover"
            hint="PNG, JPEG, WEBP, or GIF, up to 5MB."
            url={coverFrontUrl}
          />
          <CoverSlot
            projectId={projectId}
            side="back"
            label="Back cover"
            hint="Optional. Shown as the final page in Read View."
            url={coverBackUrl}
          />
        </div>

        <BackCoverBlurb projectId={projectId} blurb={backCoverBlurb} />
      </CardContent>
    </Card>
  )
}
