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
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import {
  PROJECT_TYPES,
  STORY_BIBLE_OPTIONAL_TYPES,
  genreFieldLabel,
  genreOptions,
  type ProjectType,
} from "@/lib/project-config"
import { createProjectAction, type NewProjectState } from "./actions"

const initialState: NewProjectState = {}

export function NewProjectForm() {
  const [state, formAction, pending] = useActionState(createProjectAction, initialState)
  const [type, setType] = useState<ProjectType>("novel")
  const [includeStoryBible, setIncludeStoryBible] = useState(true)

  const selectedType = PROJECT_TYPES.find((t) => t.value === type)
  const bibleIsOptional = STORY_BIBLE_OPTIONAL_TYPES.includes(type)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Start a new project</CardTitle>
        <CardDescription>
          A few quick questions — you can change any of this later.
        </CardDescription>
      </CardHeader>

      <form action={formAction}>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              name="title"
              placeholder="Working title is fine for now"
              aria-invalid={!!state.fieldErrors?.title}
            />
            {state.fieldErrors?.title ? (
              <p className="text-xs text-destructive">{state.fieldErrors.title}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="type">What kind of project is it?</Label>
            <Select
              value={type}
              onValueChange={(value) => setType(value as ProjectType)}
              name="type"
            >
              <SelectTrigger id="type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROJECT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedType ? (
              <p className="text-xs text-muted-foreground">{selectedType.description}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="genre">{genreFieldLabel(type)}</Label>
            <Select key={type} name="genre">
              <SelectTrigger id="genre">
                <SelectValue placeholder={`Select a ${genreFieldLabel(type).toLowerCase()} (optional)`} />
              </SelectTrigger>
              <SelectContent>
                {genreOptions(type).map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {bibleIsOptional ? (
            <label
              htmlFor="includeStoryBible"
              className="flex cursor-pointer items-start gap-2.5 rounded-md border border-border bg-muted/40 px-3 py-2.5"
            >
              <Checkbox
                id="includeStoryBible"
                name="includeStoryBible"
                checked={includeStoryBible}
                onCheckedChange={(checked) => setIncludeStoryBible(checked === true)}
                className="mt-0.5"
              />
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-foreground">
                  Include Characters, World &amp; Plot sections
                </span>
                <span className="text-xs text-muted-foreground">
                  Useful if your {selectedType?.label.toLowerCase()} still has a cast, setting,
                  or throughline worth tracking. You can add these later either way.
                </span>
              </span>
            </label>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="blurb">What&apos;s it about?</Label>
            <Textarea
              id="blurb"
              name="blurb"
              placeholder="A sentence or two — this becomes your Overview page. Optional."
              rows={3}
            />
          </div>
        </CardContent>

        <CardFooter className="mt-5 border-t pt-5">
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Creating…" : "Create project"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
