"use client"

import { useSyncExternalStore } from "react"
import { motion } from "motion/react"

function greetingFor(hour: number): string {
  if (hour < 5) return "Still up"
  if (hour < 12) return "Good morning"
  if (hour < 18) return "Good afternoon"
  return "Good evening"
}

const subscribe = () => () => {}

// Computed in the browser, not on the server: the server's clock is in the
// server's timezone, which is rarely the writer's. The server snapshot is
// null, so the line simply fades in once the local hour is known.
export function Greeting({ firstName }: { firstName?: string }) {
  const hour = useSyncExternalStore(
    subscribe,
    () => new Date().getHours(),
    () => null
  )

  return (
    <p className="mb-8 min-h-7 text-center font-heading text-lg text-foreground">
      {hour === null ? null : (
        <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
          {greetingFor(hour)}
          {firstName ? `, ${firstName}` : ""}.
        </motion.span>
      )}
    </p>
  )
}
