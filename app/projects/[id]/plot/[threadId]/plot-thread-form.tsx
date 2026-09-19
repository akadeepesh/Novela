"use client"

import { useActionState } from "react"
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
import { PLOT_STATUSES } from "@/lib/plot-config"
import type { SerializedPlotThread } from "@/lib/plot-threads"
import { updatePlotThreadAction, type UpdatePlotThreadState } from "./actions"

const initialState: UpdatePlotThreadState = {}

export function PlotThreadForm({ thread }: { thread: SerializedPlotThread }) {
  const boundAction = updatePlotThreadAction.bind(null, thread.projectId, thread.id)
  const [state, formAction, pending] = useActionState(boundAction, initialState)

  return (
    <Card>
      <form action={formAction}>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
          <CardDescription>What this thread is and where it stands.</CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-5">
          {state.error ? (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {state.error}
            </p>
          ) : null}

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-[1fr_auto]">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="title">Title</Label>
              <Input id="title" name="title" defaultValue={thread.title} />
            </div>

            <div className="flex flex-col gap-1.5 sm:w-44">
              <Label htmlFor="status">Status</Label>
              <Select name="status" defaultValue={thread.status}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLOT_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
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
              placeholder="Other names this thread goes by, separated by commas"
              defaultValue={thread.aliases.join(", ")}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              rows={5}
              placeholder="What's this thread about, and what's at stake?"
              defaultValue={thread.description}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              name="notes"
              rows={4}
              placeholder="Anything else worth remembering"
              defaultValue={thread.notes}
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
