import { extractBlocks } from "./text"
import { deadAppears, factConflicts, forgotten, nameDrift, openThreads, prepare, timeline } from "./rules"
import type { Issue, StoryCheckInput } from "./types"

const SEVERITY_ORDER = { warning: 0, info: 1 } as const

/** Runs every rule and drops what the writer chose to ignore. */
export function runStoryCheck(input: StoryCheckInput): Issue[] {
  const p = prepare(input, extractBlocks)
  const all = [
    ...factConflicts(p),
    ...deadAppears(p),
    ...nameDrift(p),
    ...timeline(p),
    ...openThreads(p),
    ...forgotten(p),
  ]
  const ignored = new Set(input.settings.ignoredIssues)
  const chapterOrder = new Map(input.chapters.map((c, i) => [c.id, i]))
  return all
    .filter((i) => !ignored.has(i.key))
    .filter((i) => !(i.entity && input.settings.ignoredRules[i.entity.id]?.includes(i.rule)))
    .sort(
      (a, b) =>
        SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
        (chapterOrder.get(a.location?.chapterId ?? "") ?? 1e9) - (chapterOrder.get(b.location?.chapterId ?? "") ?? 1e9)
    )
}
