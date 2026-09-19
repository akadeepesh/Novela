"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ArrowLeftIcon } from "@phosphor-icons/react/dist/ssr"
import { cn } from "cn"
import { SECTION_DEFS, sectionLabel, projectTypeLabel } from "@/lib/project-config"
import type { SerializedProject } from "@/lib/projects"

export function ProjectSidebar({ project }: { project: SerializedProject }) {
  const pathname = usePathname()

  return (
    <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex flex-col gap-1 px-4 pt-4 pb-3">
        <Link
          href="/dashboard"
          className="inline-flex w-fit items-center gap-1 text-xs text-sidebar-foreground/60 hover:text-sidebar-foreground"
        >
          <ArrowLeftIcon className="size-3" />
          All projects
        </Link>
        <h2
          className="mt-1 truncate font-heading text-sm font-semibold text-sidebar-foreground"
          title={project.title}
        >
          {project.title}
        </h2>
        <span className="text-xs text-sidebar-foreground/60">
          {projectTypeLabel(project.type)}
        </span>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2.5 pb-4">
        {project.sections.map((sectionId) => {
          const { icon: IconComponent } = SECTION_DEFS[sectionId]
          const href = `/projects/${project.id}/${sectionId}`
          const isActive = pathname === href

          return (
            <Link
              key={sectionId}
              href={href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                isActive
                  ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
              )}
            >
              <IconComponent className="size-4 shrink-0" weight={isActive ? "fill" : "regular"} />
              {sectionLabel(sectionId, project.type)}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
