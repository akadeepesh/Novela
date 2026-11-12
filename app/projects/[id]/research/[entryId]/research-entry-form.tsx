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
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { RESEARCH_ENTRY_TYPES, type ResearchEntryType } from "@/lib/research-config"
import type { SerializedResearchEntry } from "@/lib/store/notes"
import { updateResearchEntryAction, type UpdateResearchEntryState } from "./actions"

const initialState: UpdateResearchEntryState = {}

export function ResearchEntryForm({ entry }: { entry: SerializedResearchEntry }) {
  const boundAction = updateResearchEntryAction.bind(null, entry.projectId, entry.id)
  const [state, formAction, pending] = useActionState(boundAction, initialState)
  const [type, setType] = useState<ResearchEntryType>(entry.type)

  return (
    <Card>
      <form action={formAction}>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
          <CardDescription>What it is and why it matters.</CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-5">
          {state.error ? (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {state.error}
            </p>
          ) : null}

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="title">Title</Label>
              <Input id="title" name="title" defaultValue={entry.title} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="type">Type</Label>
              <Select name="type" value={type} onValueChange={(v) => setType(v as ResearchEntryType)}>
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RESEARCH_ENTRY_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {type !== "note" ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="url">{type === "image" ? "Image URL" : "Link URL"}</Label>
              <Input id="url" name="url" placeholder="https://…" defaultValue={entry.url} />
            </div>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="content">{type === "note" ? "Note" : "Caption / why it matters"}</Label>
            <Textarea
              id="content"
              name="content"
              rows={type === "note" ? 10 : 4}
              placeholder={
                type === "note"
                  ? "Write out what you found…"
                  : "What's useful about this source?"
              }
              defaultValue={entry.content}
            />
          </div>
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
