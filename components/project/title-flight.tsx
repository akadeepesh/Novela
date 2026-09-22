"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { motion } from "motion/react"

/**
 * The "title flight": when a project is created, the title the writer just
 * typed lifts off the creation canvas and settles into the sidebar of the
 * editor, while the canvas's paper dissolves into the workspace.
 *
 * Why this isn't Motion's `layoutId`: that needs the old and new element to
 * swap inside one React commit, which a Next.js route change (server fetch,
 * streaming) doesn't guarantee. Instead this layer lives in
 * `app/projects/layout.tsx` — above both routes, so it survives the
 * navigation — and animates a single fixed element between two rectangles
 * it measures from the real DOM. Nothing here depends on render timing.
 */

type Rect = { x: number; y: number; width: number; fontSize: number; lineHeight: number }

export type FlightStart = {
  text: string
  /** Placeholder text is dim on the canvas; it reaches full strength in flight. */
  fromOpacity: number
  style: { fontFamily: string; fontWeight: string; letterSpacing: string; color: string }
  from: Rect
}

type Phase = "waiting" | "flying" | "landed"

type FlightContext = {
  /** A flight is in progress. */
  active: boolean
  /** The landing spot should stay invisible — the flying copy stands in for it. */
  targetHidden: boolean
  start: (flight: FlightStart) => void
  cancel: () => void
  registerTarget: (el: HTMLElement | null) => void
}

const noop = () => {}
const FlightCtx = createContext<FlightContext>({
  active: false,
  targetHidden: false,
  start: noop,
  cancel: noop,
  registerTarget: noop,
})

export const useTitleFlight = () => useContext(FlightCtx)

/** Keeps a landing spot invisible mid-flight, then fades it in on arrival. */
export function titleTargetStyle(hidden: boolean): React.CSSProperties {
  return hidden ? { opacity: 0 } : { opacity: 1, transition: "opacity 180ms ease-out" }
}

/**
 * Marks an element as where a flying title should land. Returns
 * `[attach, hidden]`: pass `attach` as the element's `ref` and
 * `titleTargetStyle(hidden)` as its style. Pass `enabled: false` for
 * duplicates (e.g. the hover-peek panel).
 */
export function useTitleTarget(enabled = true): [(el: HTMLElement | null) => void, boolean] {
  const { registerTarget, targetHidden } = useTitleFlight()
  const attach = useCallback(
    (el: HTMLElement | null) => {
      if (enabled) registerTarget(el)
    },
    [enabled, registerTarget]
  )
  return [attach, enabled && targetHidden]
}

/** Reads the title input's exact on-screen text position and typography. */
export function measureFlightStart(
  input: HTMLInputElement,
  text: string,
  isPlaceholder: boolean
): FlightStart {
  // A title longer than the field leaves the input scrolled to its tail;
  // the flying copy starts from the head, so show the head first.
  input.scrollLeft = 0
  const rect = input.getBoundingClientRect()
  const cs = getComputedStyle(input)
  const fontSize = parseFloat(cs.fontSize)
  const lineHeight = parseFloat(cs.lineHeight) || rect.height

  // The input centers its text, so find where the text itself begins.
  const probe = document.createElement("span")
  probe.textContent = text
  Object.assign(probe.style, {
    position: "absolute",
    visibility: "hidden",
    whiteSpace: "pre",
    fontFamily: cs.fontFamily,
    fontSize: cs.fontSize,
    fontWeight: cs.fontWeight,
    letterSpacing: cs.letterSpacing,
  })
  document.body.appendChild(probe)
  const textWidth = probe.getBoundingClientRect().width
  probe.remove()

  const width = Math.min(textWidth, rect.width)
  return {
    text,
    fromOpacity: isPlaceholder ? 0.3 : 1,
    style: {
      fontFamily: cs.fontFamily,
      fontWeight: cs.fontWeight,
      letterSpacing: cs.letterSpacing,
      color: cs.color,
    },
    from: {
      // Browsers pixel-snap native input text (box top first, then the
      // centred line), so mirror that rounding — otherwise the hand-off
      // shows as a hairline ghost around every glyph for one frame.
      x: Math.round(rect.left + (rect.width - width) / 2),
      y: Math.round(Math.round(rect.top) + (rect.height - lineHeight) / 2),
      // +2px so sub-pixel rounding never clips the last glyph.
      width: width + 2,
      fontSize,
      lineHeight,
    },
  }
}

export function TitleFlightProvider({ children }: { children: React.ReactNode }) {
  const [flight, setFlight] = useState<FlightStart | null>(null)
  const [phase, setPhase] = useState<Phase>("waiting")
  const [to, setTo] = useState<Rect | null>(null)
  const [target, setTarget] = useState<HTMLElement | null>(null)
  const [slow, setSlow] = useState(false)

  const start = useCallback((next: FlightStart) => {
    setTo(null)
    setSlow(false)
    setPhase("waiting")
    setFlight(next)
  }, [])
  const cancel = useCallback(() => setFlight(null), [])

  // Once the destination has rendered its title, measure it and take off.
  useEffect(() => {
    if (!flight || phase !== "waiting" || !target) return
    const frame = requestAnimationFrame(() => {
      if (!target.isConnected) return
      const r = target.getBoundingClientRect()
      const cs = getComputedStyle(target)
      const fontSize = parseFloat(cs.fontSize)
      setTo({
        x: r.left,
        y: r.top,
        width: r.width,
        fontSize,
        lineHeight: parseFloat(cs.lineHeight) || fontSize * 1.3,
      })
      setPhase("flying")
    })
    return () => cancelAnimationFrame(frame)
  }, [flight, phase, target])

  // If the editor is slow to arrive, let the title breathe so the screen
  // never looks frozen. (Fast loads never reach this.)
  useEffect(() => {
    if (!flight || phase !== "waiting") return
    const timer = setTimeout(() => setSlow(true), 800)
    return () => clearTimeout(timer)
  }, [flight, phase])

  // Never strand the writer behind the overlay if the destination fails to load.
  useEffect(() => {
    if (!flight) return
    const timer = setTimeout(() => setFlight(null), 10_000)
    return () => clearTimeout(timer)
  }, [flight])

  const value = useMemo<FlightContext>(
    () => ({
      active: flight !== null,
      targetHidden: flight !== null && phase !== "landed",
      start,
      cancel,
      registerTarget: setTarget,
    }),
    [flight, phase, start, cancel]
  )

  const fromState = flight
    ? {
        x: flight.from.x,
        y: flight.from.y,
        width: flight.from.width,
        fontSize: flight.from.fontSize,
        lineHeight: `${flight.from.lineHeight}px`,
        opacity: flight.fromOpacity,
      }
    : null

  const animateState =
    !flight || !fromState
      ? undefined
      : phase === "waiting" || !to
        ? slow
          ? { ...fromState, opacity: [flight.fromOpacity, flight.fromOpacity * 0.6, flight.fromOpacity] }
          : fromState
        : {
            x: to.x,
            y: to.y,
            width: to.width,
            fontSize: to.fontSize,
            lineHeight: `${to.lineHeight}px`,
            opacity: phase === "landed" ? 0 : 1,
          }

  return (
    <FlightCtx.Provider value={value}>
      {children}

      {flight && fromState ? (
        <div className="pointer-events-none fixed inset-0 z-[100]" aria-hidden>
          {/* The canvas's paper. It stays put until the editor is ready
              underneath, then dissolves to reveal the workspace. */}
          <motion.div
            className="absolute inset-0 bg-manuscript-bg"
            initial={{ opacity: 1 }}
            animate={{ opacity: phase === "waiting" ? 1 : 0 }}
            transition={
              phase === "waiting"
                ? { duration: 0 }
                : // Dissolves *across* the glide, finishing as the title settles.
                  { duration: 0.6, delay: 0.15, ease: "easeInOut" }
            }
          />

          {/* No wrapper element here on purpose: an extra compositing layer
              makes the text lose sub-pixel antialiasing, and the hand-off
              from the native input stops being pixel-identical. */}
          <motion.div
            className="absolute top-0 left-0 overflow-hidden text-ellipsis whitespace-pre"
            style={flight.style}
            initial={fromState}
            animate={animateState}
            transition={
              phase === "flying"
                ? // Soft lift-off, a real glide, a long soft landing.
                  { duration: 0.8, ease: [0.45, 0, 0.15, 1] }
                : phase === "landed"
                  ? { duration: 0.18, ease: "easeOut" }
                  : phase === "waiting" && slow
                    ? { opacity: { duration: 1.8, repeat: Infinity, ease: "easeInOut" }, default: { duration: 0 } }
                    : { duration: 0 }
            }
            onAnimationComplete={() => {
              if (phase === "flying") setPhase("landed")
              else if (phase === "landed") setFlight(null)
            }}
          >
            {flight.text}
          </motion.div>
        </div>
      ) : null}
    </FlightCtx.Provider>
  )
}
