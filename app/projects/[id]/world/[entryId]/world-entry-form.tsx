"use client"

import { useActionState, createElement } from "react"
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
import { WORLD_ENTRY_TYPES, worldEntryTypeIcon } from "@/lib/world-config"
import type { SerializedWorldEntry } from "@/lib/world-entries"
import { updateWorldEntryAction, createWorldEntryFromFormAction, type UpdateWorldEntryState } from "./actions"

const initialState: UpdateWorldEntryState = {}

export function WorldEntryForm({ entry }: { entry: SerializedWorldEntry }) {
  // An empty id means the blank "new" form: Save creates the record.
  const boundAction = entry.id
    ? updateWorldEntryAction.bind(null, entry.projectId, entry.id)
    : createWorldEntryFromFormAction.bind(null, entry.projectId)
  const [state, formAction, pending] = useActionState(boundAction, initialState)
  const worldEntryTypeIconComponent = worldEntryTypeIcon(entry.type)

  return (
    <Card>
      <form action={formAction}>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
          <CardDescription>What it is and where it fits in your world.</CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-5">
          {state.error ? (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {state.error}
            </p>
          ) : null}

          <div className="flex items-center gap-4">
            <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted text-muted-foreground">
              {entry.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={entry.imageUrl} alt={entry.name} className="size-full object-cover" />
              ) : (
                createElement(worldEntryTypeIconComponent, { className: "size-7", weight: "duotone" })
              )}
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="imageUrl">Image URL</Label>
              <Input
                id="imageUrl"
                name="imageUrl"
                placeholder="https://…"
                defaultValue={entry.imageUrl}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                name="name"
                defaultValue={entry.name}
                autoFocus={!entry.id}
                required
                pattern=".*\S.*"
                title="Give this a name"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="type">Type</Label>
              <Select name="type" defaultValue={entry.type}>
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WORLD_ENTRY_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="aliases">Also known as</Label>
            <Input
              id="aliases"
              name="aliases"
              placeholder="Other names it goes by, separated by commas"
              defaultValue={entry.aliases.join(", ")}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              rows={5}
              placeholder="What is it, what does it look like, what makes it matter?"
              defaultValue={entry.description}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              name="notes"
              rows={4}
              placeholder="Anything else worth remembering"
              defaultValue={entry.notes}
            />
          </div>
        </CardContent>

        <CardFooter className="mt-5 items-center gap-3 border-t pt-5">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : entry.id ? "Save changes" : "Create entry"}
          </Button>
          {state.success ? <span className="text-sm text-muted-foreground">Saved.</span> : null}
        </CardFooter>
      </form>
    </Card>
  )
}
