"use client"

import { useEffect, useRef, useState } from "react"
import { useLiveQuery } from "dexie-react-hooks"
import { loadStoryCheckInput } from "./load"
import { runStoryCheck } from "./run"
import type { Issue, StoryCheckInput } from "./types"

/** Wait this long after the last change before checking again. */
const DEBOUNCE_MS = 700

type State = { issues: Issue[]; checking: boolean; ready: boolean }

/**
 * Story Check for one project, kept up to date as the book changes. Runs in
 * a Web Worker when the browser allows it, otherwise on the main thread.
 */
export function useStoryCheck(projectId: string): State {
  const input = useLiveQuery(() => loadStoryCheckInput(projectId), [projectId])
  const [state, setState] = useState<State>({ issues: [], checking: true, ready: false })
  const workerRef = useRef<Worker | null>(null)
  const runId = useRef(0)

  useEffect(() => {
    try {
      workerRef.current = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" })
      workerRef.current.onmessage = (e: MessageEvent<{ id: number; issues: Issue[] }>) => {
        if (e.data.id === runId.current) setState({ issues: e.data.issues, checking: false, ready: true })
      }
    } catch {
      workerRef.current = null
    }
    return () => {
      workerRef.current?.terminate()
      workerRef.current = null
    }
  }, [])

  useEffect(() => {
    if (input === undefined) return
    const id = ++runId.current
    const run = (data: StoryCheckInput | null) => {
      if (!data) {
        setState({ issues: [], checking: false, ready: true })
        return
      }
      if (workerRef.current) workerRef.current.postMessage({ id, input: data })
      else setState({ issues: runStoryCheck(data), checking: false, ready: true })
    }
    const timer = setTimeout(() => {
      setState((s) => ({ ...s, checking: true }))
      run(input)
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [input])

  return state
}
