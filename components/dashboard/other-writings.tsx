"use client"

import Link from "next/link"
import { motion } from "motion/react"
import { CaretRightIcon } from "@phosphor-icons/react/dist/ssr"
import { PROJECT_TYPE_ICON } from "@/lib/project-config"
import { relativeTime } from "@/lib/format"
import { ProjectMenu } from "@/components/dashboard/project-menu"
import type { DashboardOther } from "@/lib/dashboard"

export function OtherWritings({ others }: { others: DashboardOther[] }) {
  if (others.length === 0) return null

  return (
    <div className="mx-auto mt-12 flex w-full max-w-lg flex-col gap-1">
      <p className="mb-1 px-1 text-xs text-muted-foreground">Other writings</p>
      {others.map((project, i) => {
        const TypeIcon = PROJECT_TYPE_ICON[project.type]
        return (
          <motion.div
            key={project.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.05 * i }}
          >
            <div className="group flex items-center rounded-md hover:bg-muted/50">
            <Link
              href={`/projects/${project.id}`}
              className="flex min-w-0 flex-1 items-center gap-2.5 px-2 py-2 text-sm"
            >
              <TypeIcon className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate text-foreground">{project.title}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {relativeTime(project.updatedAt)}
              </span>
              <CaretRightIcon className="size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </Link>
            <ProjectMenu projectId={project.id} />
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}
