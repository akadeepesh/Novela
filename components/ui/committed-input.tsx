"use client"

import { useEffect, useRef, useState } from "react"
import { Input } from "@/components/ui/input"

const COMMIT_DELAY_MS = 500

type BaseProps = Omit<React.ComponentProps<typeof Input>, "value" | "defaultValue" | "onChange" | "type">

/**
 * A text input for settings that save themselves. It keeps what is typed
 * locally and calls `onCommit` once typing pauses, on blur, and on unmount,
 * instead of once per keystroke. One save per pause means requests can't
 * finish out of order and leave a half-typed value ("Par" instead of
 * "Part") as the saved one.
 */
export function DebouncedInput({
  value,
  onCommit,
  onBlur,
  ...props
}: BaseProps & { value: string; onCommit: (value: string) => void }) {
  const [draft, setDraft] = useState(value)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const committed = useRef(value)
  const latest = useRef({ draft: value, onCommit })
  useEffect(() => {
    latest.current = { draft, onCommit }
  })

  function commit() {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
    const { draft: next, onCommit: send } = latest.current
    if (next === committed.current) return
    committed.current = next
    send(next)
  }

  // Commit anything still waiting when the input goes away (panel closed,
  // checkbox unticked, page left). `commit` reads only refs, so the
  // first render's copy is always current.
  useEffect(() => () => commit(), [])

  return (
    <Input
      {...props}
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value)
        latest.current.draft = e.target.value
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(commit, COMMIT_DELAY_MS)
      }}
      onBlur={(e) => {
        commit()
        onBlur?.(e)
      }}
    />
  )
}

/**
 * A number input that only reports values inside [min, max]. While the
 * field is empty or out of range mid-edit, nothing is applied; on blur it
 * snaps back to the last valid value. (Number("") is 0, which would
 * otherwise be applied as a font size of 0.)
 */
export function BoundedNumberInput({
  value,
  min,
  max,
  onValidChange,
  onBlur,
  ...props
}: BaseProps & { value: number; min: number; max: number; onValidChange: (value: number) => void }) {
  const [draft, setDraft] = useState(String(value))
  const [prevValue, setPrevValue] = useState(value)
  if (value !== prevValue) {
    setPrevValue(value)
    setDraft(String(value))
  }

  return (
    <Input
      {...props}
      type="number"
      min={min}
      max={max}
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value)
        const n = e.target.value.trim() === "" ? NaN : Number(e.target.value)
        if (Number.isFinite(n) && n >= min && n <= max && n !== value) onValidChange(n)
      }}
      onBlur={(e) => {
        setDraft(String(value))
        onBlur?.(e)
      }}
    />
  )
}
