"use client"

import Link from "next/link"
import { FeatherIcon, PlusIcon, TrashIcon } from "@phosphor-icons/react/dist/ssr"
import { Button } from "@/components/ui/button"
import { APP_NAME } from "@/lib/brand"
import { AppMenu } from "@/components/app-menu"
import { Greeting } from "@/components/dashboard/greeting"
import { HeroCard } from "@/components/dashboard/hero-card"
import { OtherWritings } from "@/components/dashboard/other-writings"
import { useDashboardData, useTrashCount } from "@/lib/store/hooks"
import { BackupReminder } from "@/components/backup/backup-reminder"
import { ImportButton } from "@/components/backup/import-button"

export function DashboardView() {
  const data = useDashboardData()
  const trashCount = useTrashCount()
  const hero = data?.hero ?? null
  const others = data?.others ?? []

  return (
    <div className="dashboard-glow flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-6 py-5 sm:px-10">
        <Link href="/dashboard" className="flex items-center gap-2 text-foreground">
          <FeatherIcon className="size-4 text-primary" weight="duotone" />
          <span className="font-heading text-sm font-semibold">{APP_NAME}</span>
        </Link>
        <div className="flex items-center gap-3">
          {trashCount ? (
            <Button
              size="sm"
              variant="ghost"
              render={<Link href="/dashboard/trash" />}
              nativeButton={false}
            >
              <TrashIcon />
              Trash ({trashCount})
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="ghost"
            render={<Link href="/projects/new" />}
            nativeButton={false}
          >
            <PlusIcon />
            New
          </Button>
          <AppMenu />
        </div>
      </header>

      <main className="flex flex-1 flex-col px-6 pb-24 sm:px-10">
        <div className="mx-auto w-full max-w-2xl">
          <Greeting />
          <BackupReminder />

          {data === undefined ? null : hero ? (
            <>
              <HeroCard hero={hero} />
              <OtherWritings others={others} />
            </>
          ) : (
            <div className="flex flex-col items-center gap-4 py-16 text-center">
              <p className="text-muted-foreground">Nothing here yet — what do you want to write?</p>
              <Button size="lg" render={<Link href="/projects/new" />} nativeButton={false}>
                <PlusIcon />
                Start writing
              </Button>
              <ImportButton label="Or import a project file" variant="ghost" />
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
