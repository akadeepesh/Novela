"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "motion/react"
import {
  ArrowLeftIcon,
  ArrowRightIcon,
} from "@phosphor-icons/react/dist/ssr"
import { cn } from "cn"
import { PROJECT_TYPES, PROJECT_TYPE_ICON, defaultProjectTitle, type ProjectType } from "@/lib/project-config"
import { createProjectAction } from "./actions"

const TAGLINE: Record<ProjectType, string> = {
  novel: "A novel",
  poetry: "A poetry collection",
  "short-stories": "A short story collection",
  nonfiction: "Non-fiction or memoir",
  "script-writing": "A script — one per episode",
  custom: "A custom project",
}

export function CreationCanvas() {
  const [title, setTitle] = useState("")
  const [type, setType] = useState<ProjectType>("novel")
  const [committing, setCommitting] = useState(false)
  const router = useRouter()

  const placeholder = defaultProjectTitle(type)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (committing) return
    setCommitting(true)
    try {
      // The write and the exit animation run together, so the "commit"
      // moment costs no extra wait beyond the animation itself.
      const formData = new FormData()
      formData.set("title", title)
      formData.set("type", type)
      const [state] = await Promise.all([
        createProjectAction({}, formData),
        new Promise((resolve) => setTimeout(resolve, 220)),
      ])
      if (!state.result) throw new Error("Failed to create project")
      router.push(`/projects/${state.result.projectId}/chapters/${state.result.chapterId}`)
    } catch {
      setCommitting(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-manuscript-bg text-manuscript-fg">
      <div className="p-6">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-sm opacity-60 hover:opacity-100"
        >
          <ArrowLeftIcon className="size-3.5" />
          Dashboard
        </Link>
      </div>

      <div className="flex flex-1 items-center justify-center px-6 pb-24">
        <AnimatePresence>
          {!committing ? (
            <motion.form
              onSubmit={handleSubmit}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="flex w-full max-w-2xl flex-col items-center gap-8 text-center"
            >
              <input
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={placeholder}
                maxLength={200}
                className="w-full bg-transparent text-center font-serif text-4xl font-medium outline-none placeholder:opacity-30 sm:text-5xl"
              />

              <div className="flex flex-col items-center gap-3">
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {PROJECT_TYPES.map((t) => {
                    const TypeIcon = PROJECT_TYPE_ICON[t.value]
                    const active = type === t.value
                    return (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setType(t.value)}
                        className={cn(
                          "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors",
                          active
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-current/15 opacity-50 hover:opacity-100"
                        )}
                      >
                        <TypeIcon className="size-3.5" weight={active ? "fill" : "regular"} />
                        {t.shortLabel}
                      </button>
                    )
                  })}
                </div>
                <p className="text-xs opacity-40">{TAGLINE[type]}</p>
              </div>

              <button
                type="submit"
                className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-primary transition-all hover:gap-2.5"
              >
                Begin writing
                <ArrowRightIcon className="size-4" />
              </button>
            </motion.form>
          ) : (
            <motion.div
              key="committing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-sm opacity-50"
            >
              Opening your page…
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
