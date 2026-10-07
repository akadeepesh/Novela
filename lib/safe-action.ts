import "server-only"
import { unstable_rethrow } from "next/navigation"
import { isObjectId } from "@/lib/object-id"

/**
 * Single place where unexpected server errors are reported. Today it logs;
 * when Sentry is added (Phase 5) call Sentry.captureException here and every
 * action is covered.
 */
export function reportError(source: string, err: unknown): void {
  console.error(`[${source}]`, err)
}

/** Shown when a form action fails unexpectedly. */
export const GENERIC_ERROR = "Something went wrong. Please try again."

type SafeActionOptions = {
  /** Positions of arguments that must be valid ObjectIds (e.g. [0, 1] for projectId, chapterId). */
  ids?: readonly number[]
}

/**
 * Wraps a server action so that it never surfaces as a 500 error page.
 *
 * - An argument listed in `ids` that is not a valid ObjectId returns the
 *   action's own failure value without touching the database.
 * - Unexpected errors are reported and turned into the same failure value.
 * - redirect(), notFound() and the like are Next.js control flow and are re-thrown untouched.
 *
 * `onError` returns the action's typed failure result, e.g. `() => ({ ok: false })`.
 */
export function safeAction<A extends unknown[], R>(
  name: string,
  action: (...args: A) => Promise<R>,
  onError: () => NoInfer<R>,
  options: SafeActionOptions = {}
): (...args: A) => Promise<R> {
  return async (...args: A): Promise<R> => {
    for (const i of options.ids ?? []) {
      if (!isObjectId(args[i])) return onError()
    }
    try {
      return await action(...args)
    } catch (err) {
      unstable_rethrow(err)
      reportError(name, err)
      return onError()
    }
  }
}
