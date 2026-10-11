"use client"

import { useActionState } from "react"
import { UserCircleIcon } from "@phosphor-icons/react/dist/ssr"
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
import { CHARACTER_ROLES } from "@/lib/character-config"
import type { SerializedCharacter } from "@/lib/characters"
import { updateCharacterAction, createCharacterFromFormAction, type UpdateCharacterState } from "./actions"

const initialState: UpdateCharacterState = {}

export function CharacterForm({ character }: { character: SerializedCharacter }) {
  // An empty id means the blank "new" form: Save creates the record.
  const boundAction = character.id
    ? updateCharacterAction.bind(null, character.projectId, character.id)
    : createCharacterFromFormAction.bind(null, character.projectId)
  const [state, formAction, pending] = useActionState(boundAction, initialState)

  return (
    <Card>
      <form action={formAction}>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
          <CardDescription>The basics — who they are and how they look.</CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-5">
          {state.error ? (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {state.error}
            </p>
          ) : null}

          <div className="flex items-center gap-4">
            <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-muted-foreground">
              {character.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={character.imageUrl}
                  alt={character.name}
                  className="size-full object-cover"
                />
              ) : (
                <UserCircleIcon className="size-8" weight="duotone" />
              )}
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="imageUrl">Image URL</Label>
              <Input
                id="imageUrl"
                name="imageUrl"
                placeholder="https://…"
                defaultValue={character.imageUrl}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                name="name"
                defaultValue={character.name}
                autoFocus={!character.id}
                required
                pattern=".*\S.*"
                title="Give this a name"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="role">Role</Label>
              <Select name="role" defaultValue={character.role}>
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHARACTER_ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
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
              placeholder="Nicknames or other names, separated by commas"
              defaultValue={character.aliases.join(", ")}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="appearance">Appearance</Label>
            <Textarea
              id="appearance"
              name="appearance"
              rows={3}
              placeholder="What do they look like?"
              defaultValue={character.appearance}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="personality">Personality</Label>
            <Textarea
              id="personality"
              name="personality"
              rows={3}
              placeholder="Temperament, quirks, what drives them"
              defaultValue={character.personality}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="backstory">Backstory</Label>
            <Textarea
              id="backstory"
              name="backstory"
              rows={4}
              placeholder="Where they came from, what shaped them"
              defaultValue={character.backstory}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              name="notes"
              rows={4}
              placeholder="Anything else worth remembering"
              defaultValue={character.notes}
            />
          </div>
        </CardContent>

        <CardFooter className="mt-5 items-center gap-3 border-t pt-5">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : character.id ? "Save changes" : "Create character"}
          </Button>
          {state.success ? <span className="text-sm text-muted-foreground">Saved.</span> : null}
        </CardFooter>
      </form>
    </Card>
  )
}
