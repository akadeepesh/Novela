import type { Metadata } from "next"
import Link from "next/link"
import { FeatherIcon, PlusIcon, TrashIcon } from "@phosphor-icons/react/dist/ssr"
import { Button } from "@/components/ui/button"
import { AvatarMenu } from "@/components/account/avatar-menu"
import { Greeting } from "@/components/dashboard/greeting"
import { HeroCard } from "@/components/dashboard/hero-card"
import { OtherWritings } from "@/components/dashboard/other-writings"
import { auth } from "@/auth"
import { getDashboardData } from "@/lib/dashboard"
import { getTrashCount } from "@/lib/trash"

export const metadata: Metadata = { title: "Your writings" }

export default async function DashboardPage() {
  const session = await auth()
  const [{ hero, others }, trashCount] = await Promise.all([
    getDashboardData(),
    session?.user?.id ? getTrashCount(session.user.id) : Promise.resolve(0),
  ])
  const firstName = session?.user?.name?.split(" ")[0]

  return (
    <div className="dashboard-glow flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-6 py-5 sm:px-10">
        <Link href="/dashboard" className="flex items-center gap-2 text-foreground">
          <FeatherIcon className="size-4 text-primary" weight="duotone" />
          <span className="font-heading text-sm font-semibold">KoraKagaj</span>
        </Link>
        <div className="flex items-center gap-3">
          {trashCount > 0 ? (
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
          <AvatarMenu />
        </div>
      </header>

      <main className="flex flex-1 flex-col px-6 pb-24 sm:px-10">
        <div className="mx-auto w-full max-w-2xl">
          <Greeting firstName={firstName} />

          {hero ? (
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
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
