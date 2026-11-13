/// <reference lib="webworker" />
import { runStoryCheck } from "./run"
import type { Issue, StoryCheckInput } from "./types"

/**
 * Runs Story Check off the main thread, so checking a long manuscript never
 * makes typing stutter. Each message carries an id; replies echo it so the
 * page can drop results that a newer run has already replaced.
 */
self.onmessage = (event: MessageEvent<{ id: number; input: StoryCheckInput }>) => {
  const { id, input } = event.data
  let issues: Issue[] = []
  try {
    issues = runStoryCheck(input)
  } catch (err) {
    console.error("Story Check failed", err)
  }
  ;(self as unknown as Worker).postMessage({ id, issues })
}
