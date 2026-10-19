"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ComponentProps } from "react"

/**
 * Lets a page with unsaved work (the chapter editor) make in-app navigation
 * wait for its save. Sidebar links and the command palette live in the
 * project shell, outside the editor, so without this they would unmount the
 * editor mid-save and a failed save would vanish with no message.
 */
export type NavigationGuard = {
  /** True while something is unsaved or a save is still in flight. */
  isPending: () => boolean
  /** Saves now; resolves false if the save failed (the page shows why). */
  flush: () => Promise<boolean>
}

type GuardRegistry = {
  register: (guard: NavigationGuard) => () => void
  current: () => NavigationGuard | null
}

const GuardContext = createContext<GuardRegistry | null>(null)

export function NavigationGuardProvider({ children }: { children: React.ReactNode }) {
  const guardRef = useRef<NavigationGuard | null>(null)
  const registry = useMemo<GuardRegistry>(
    () => ({
      register(guard) {
        guardRef.current = guard
        return () => {
          if (guardRef.current === guard) guardRef.current = null
        }
      },
      current: () => guardRef.current,
    }),
    []
  )
  return <GuardContext.Provider value={registry}>{children}</GuardContext.Provider>
}

/** Registers `guard` for as long as the calling component is mounted. */
export function useRegisterNavigationGuard(guard: NavigationGuard) {
  const registry = useContext(GuardContext)
  useEffect(() => registry?.register(guard), [registry, guard])
}

/**
 * Navigates to `href`, first waiting for any pending save. Stays on the page
 * if that save fails, so the person sees the error instead of losing text.
 */
export function useGuardedPush() {
  const registry = useContext(GuardContext)
  const router = useRouter()
  return useCallback(
    (href: string) => {
      const guard = registry?.current()
      if (!guard || !guard.isPending()) {
        router.push(href)
        return
      }
      void guard.flush().then((ok) => {
        if (ok) router.push(href)
      })
    },
    [registry, router]
  )
}

/** A Link that waits for a pending save before leaving the page. */
export function GuardedLink({ onClick, ...props }: ComponentProps<typeof Link>) {
  const registry = useContext(GuardContext)
  const push = useGuardedPush()
  return (
    <Link
      {...props}
      onClick={(e) => {
        onClick?.(e)
        if (e.defaultPrevented) return
        // New tab / window: this page stays open, nothing to wait for.
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
        if (typeof props.href !== "string" || !registry?.current()?.isPending()) return
        e.preventDefault()
        push(props.href)
      }}
    />
  )
}
