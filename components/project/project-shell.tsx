"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { ArrowLeftIcon, SidebarSimpleIcon } from "@phosphor-icons/react/dist/ssr"
import { cn } from "cn"
import { SECTION_DEFS, sectionLabel, projectTypeLabel } from "@/lib/project-config"
import type { SerializedProject } from "@/lib/projects"
import type { SearchItem } from "@/lib/search"
import { CommandPalette } from "./command-palette"

const COLLAPSE_COOKIE = "sidebar-collapsed"

function setCollapseCookie(collapsed: boolean) {
  // A year is effectively "remember this forever" for a UI preference.
  document.cookie = `${COLLAPSE_COOKIE}=${collapsed ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`
}

export function ProjectShell({
  project,
  searchItems,
  defaultCollapsed,
  children,
}: {
  project: SerializedProject
  searchItems: SearchItem[]
  defaultCollapsed: boolean
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(defaultCollapsed)

  useEffect(() => {
    // Set on <html> (not just this subtree) so the accent reaches Base
    // UI's portaled dialogs/selects/popups too — those render into
    // document.body, outside whatever DOM this component sits in.
    document.documentElement.setAttribute("data-genre", project.type)
    return () => {
      document.documentElement.removeAttribute("data-genre")
    }
  }, [project.type])

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev
      setCollapseCookie(next)
      return next
    })
  }

  return (
    <div className="flex flex-1">
      {!collapsed ? (
        <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
          <div className="flex items-center justify-between px-3 pt-3">
            <Link
              href="/dashboard"
              className="inline-flex w-fit items-center gap-1 text-xs text-sidebar-foreground/60 hover:text-sidebar-foreground"
            >
              <ArrowLeftIcon className="size-3" />
              All projects
            </Link>
            <button
              type="button"
              onClick={toggle}
              className="rounded-md p-1 text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
            >
              <SidebarSimpleIcon className="size-4" />
            </button>
          </div>

          <div className="flex flex-col gap-1 px-4 pt-2 pb-3">
            <h2
              className="truncate font-heading text-sm font-semibold text-sidebar-foreground"
              title={project.title}
            >
              {project.title}
            </h2>
            <span className="text-xs text-sidebar-foreground/60">
              {projectTypeLabel(project.type)}
            </span>
          </div>

          <CommandPalette
            projectId={project.id}
            projectType={project.type}
            sections={project.sections}
            items={searchItems}
          />

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
                  <IconComponent
                    className="size-4 shrink-0"
                    weight={isActive || project.type === "novel" ? "fill" : "regular"}
                  />
                  {sectionLabel(sectionId, project.type)}
                </Link>
              )
            })}
          </nav>
        </aside>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        {collapsed ? (
          <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-sidebar-border bg-sidebar px-3 py-2.5">
            <button
              type="button"
              onClick={toggle}
              className="rounded-md p-1 text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
              aria-label="Expand sidebar"
              title="Expand sidebar"
            >
              <SidebarSimpleIcon className="size-4" />
            </button>
            <span
              className="truncate font-heading text-sm font-semibold text-sidebar-foreground"
              title={project.title}
            >
              {project.title}
            </span>

            {/* Keeps the Cmd+K listener and modal alive while collapsed,
                without showing the "Search…" button here — it has no good
                home in this slim bar, and the shortcut still works. */}
            <CommandPalette
              projectId={project.id}
              projectType={project.type}
              sections={project.sections}
              items={searchItems}
              hideTrigger
            />
          </div>
        ) : null}

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  )
}
