"use client"

import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useChapters } from "@/lib/store/hooks"

/** Which chapter resolves this thread. Story Check stops reporting it as open once set. */
export function ResolvedInField({ projectId, value }: { projectId: string; value?: string }) {
  const chapters = useChapters(projectId)
  const items = [
    { value: "none", label: "Not resolved yet" },
    ...(chapters ?? []).map((c, i) => ({ value: c.id, label: `${i + 1}. ${c.title}` })),
  ]
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="resolvedChapterId">Resolved in</Label>
      <Select name="resolvedChapterId" items={items} defaultValue={value ?? "none"}>
        <SelectTrigger id="resolvedChapterId">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((c) => (
            <SelectItem key={c.value} value={c.value}>
              {c.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
