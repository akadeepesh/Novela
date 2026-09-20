"use client"

import { useActionState, useState } from "react"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import type { SerializedNote } from "@/lib/notes"
import { updateNoteAction, type UpdateNoteState } from "./actions"

const initialState: UpdateNoteState = {}

export function NoteForm({ note }: { note: SerializedNote }) {
  const boundAction = updateNoteAction.bind(null, note.projectId, note.id)
  const [state, formAction, pending] = useActionState(boundAction, initialState)
  const [pinned, setPinned] = useState(note.pinned)

  return (
    <Card>
      <form action={formAction}>
        <CardHeader>
          <CardTitle className="text-base">Note</CardTitle>
          <CardDescription>Freeform — write whatever you need to remember.</CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-5">
          {state.error ? (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {state.error}
            </p>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" defaultValue={note.title} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="content">Content</Label>
            <Textarea
              id="content"
              name="content"
              rows={12}
              placeholder="Write it down before you lose it…"
              defaultValue={note.content}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tags">Tags</Label>
            <Input
              id="tags"
              name="tags"
              placeholder="Separated by commas"
              defaultValue={note.tags.join(", ")}
            />
          </div>

          <label
            htmlFor="pinned"
            className="flex w-fit cursor-pointer items-center gap-2.5 rounded-md border border-border bg-muted/40 px-3 py-2.5"
          >
            <Checkbox
              id="pinned"
              name="pinned"
              checked={pinned}
              onCheckedChange={(checked) => setPinned(checked === true)}
            />
            <span className="text-sm">Pin this note to the top of the list</span>
          </label>
        </CardContent>

        <CardFooter className="mt-5 items-center gap-3 border-t pt-5">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save changes"}
          </Button>
          {state.success ? <span className="text-sm text-muted-foreground">Saved.</span> : null}
        </CardFooter>
      </form>
    </Card>
  )
}
