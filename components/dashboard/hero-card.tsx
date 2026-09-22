"use client"

import Link from "next/link"
import { motion } from "motion/react"
import { ArrowRightIcon } from "@phosphor-icons/react/dist/ssr"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PROJECT_TYPE_ICON, projectTypeLabel } from "@/lib/project-config"
import { relativeTime } from "@/lib/format"
import type { DashboardHero } from "@/lib/dashboard"

export function HeroCard({ hero }: { hero: DashboardHero }) {
  const TypeIcon = PROJECT_TYPE_ICON[hero.type]
  const continueHref = hero.chapter
    ? `/projects/${hero.id}/chapters/${hero.chapter.id}`
    : `/projects/${hero.id}/chapters`

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      <Link href={`/projects/${hero.id}/overview`} className="block">
        <Card className="glass-card items-center gap-4 py-10 text-center transition-colors hover:border-foreground/20 sm:py-14 dark:hover:border-foreground/30">
          <div className="flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <TypeIcon className="size-4" />
          </div>

          <h1 className="max-w-lg font-serif text-3xl font-medium text-foreground sm:text-4xl">
            {hero.title}
          </h1>

          <p className="text-sm text-muted-foreground">
            {hero.chapter
              ? `Last worked on: ${hero.chapter.title} · ${relativeTime(hero.chapter.updatedAt)}`
              : projectTypeLabel(hero.type)}
          </p>

          <div className="mt-2 flex items-center gap-4">
            <Button
              size="lg"
              render={<Link href={continueHref} />}
              nativeButton={false}
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
            >
              Continue writing
              <ArrowRightIcon />
            </Button>
          </div>
        </Card>
      </Link>
    </motion.div>
  )
}
