"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useChapters } from "@/lib/store/hooks"
import type { SerializedCharacter } from "@/lib/store/bible"

const PRONOUNS = [
  { value: "none", label: "Not set" },
  { value: "she", label: "she / her" },
  { value: "he", label: "he / him" },
  { value: "they", label: "they / them" },
]

const STATUSES = [
  { value: "none", label: "Not set" },
  { value: "alive", label: "Alive" },
  { value: "dead", label: "Dead" },
  { value: "missing", label: "Missing" },
]

/**
 * Optional, structured facts that Story Check compares with the text. Kept
 * separate from the free-form profile so writers can ignore them entirely.
 */
export function StoryFactsFields({ character }: { character: SerializedCharacter }) {
  const chapters = useChapters(character.projectId)
  const [status, setStatus] = useState<string>(character.status ?? "none")
  const chapterItems = [
    { value: "none", label: "Not set" },
    ...(chapters ?? []).map((c, i) => ({ value: c.id, label: `${i + 1}. ${c.title}` })),
  ]

  return (
    <fieldset className="flex flex-col gap-4 rounded-lg border border-border p-4">
      <legend className="px-1 text-sm font-medium text-foreground">Story facts</legend>
      <p className="-mt-1 text-xs text-muted-foreground">
        Optional. Story Check uses these to catch slips, like the wrong eye colour or a character
        speaking after they died.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="eyeColor">Eye colour</Label>
          <Input id="eyeColor" name="eyeColor" placeholder="e.g. green" defaultValue={character.eyeColor} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="hairColor">Hair colour</Label>
          <Input id="hairColor" name="hairColor" placeholder="e.g. black" defaultValue={character.hairColor} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="birthYear">Birth year</Label>
          <Input
            id="birthYear"
            name="birthYear"
            inputMode="numeric"
            placeholder="e.g. 1990"
            defaultValue={character.birthYear?.toString()}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pronouns">Pronouns</Label>
          <Select name="pronouns" items={PRONOUNS} defaultValue={character.pronouns ?? "none"}>
            <SelectTrigger id="pronouns">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRONOUNS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="status">Status</Label>
          <Select name="status" items={STATUSES} value={status} onValueChange={(v) => setStatus(String(v ?? "none"))}>
            <SelectTrigger id="status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {status === "dead" || status === "missing" ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="statusChapterId">{status === "dead" ? "Dies in" : "Goes missing in"}</Label>
            <Select name="statusChapterId" items={chapterItems} defaultValue={character.statusChapterId ?? "none"}>
              <SelectTrigger id="statusChapterId">
                <SelectValue placeholder="Choose a chapter" />
              </SelectTrigger>
              <SelectContent>
                {chapterItems.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>
    </fieldset>
  )
}
