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
import { Button } from "@/components/ui/button"
import type { SerializedProject } from "@/lib/store/projects"
import { updateOverviewAction, type UpdateOverviewState } from "./actions"

const initialState: UpdateOverviewState = {}

export function OverviewForm({ project }: { project: SerializedProject }) {
  const boundAction = updateOverviewAction.bind(null, project.id)
  const [state, formAction, pending] = useActionState(boundAction, initialState)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Details</CardTitle>
        <CardDescription>The basics — shown on your dashboard and used for export.</CardDescription>
      </CardHeader>

      <form action={formAction}>
        <CardContent className="flex flex-col gap-5">
          {state.error ? (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {state.error}
            </p>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" defaultValue={project.title} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="authorName">Author name</Label>
            <Input
              id="authorName"
              name="authorName"
              placeholder="How your name should appear on the title page"
              defaultValue={project.authorName}
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
