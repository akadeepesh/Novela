"use client"

/**
 * Runs async calls one at a time, in the order they were enqueued, even if
 * the caller doesn't await between them.
 *
 * Why this exists: the chapter editor can fire two independent server
 * actions moments apart — a manuscript-settings change (background, font)
 * and the debounced content autosave — as plain fire-and-forget calls with
 * no coordination between them. Two Server Action requests genuinely
 * in-flight at once from the same page is a real edge case worth avoiding
 * outright: at best it's wasted races on write ordering, at worst it's
 * exactly the kind of overlap that's fragile in this Next.js/React version.
 * A queue removes the overlap at the source instead of guessing at the
 * exact framework internals.
 *
 * A failed call doesn't block the ones queued after it — each runs
 * regardless of whether the previous one resolved or rejected.
 */
export function createActionQueue() {
  let tail: Promise<unknown> = Promise.resolve()

  return function enqueue<T>(run: () => Promise<T>): Promise<T> {
    const result = tail.then(run, run)
    tail = result.then(
      () => undefined,
      () => undefined
    )
    return result
  }
}

export type ActionQueue = ReturnType<typeof createActionQueue>
