import type { Metadata } from "next"
import Link from "next/link"
import { ChatTeardropTextIcon, FeatherIcon, PlusIcon, TrashIcon } from "@phosphor-icons/react/dist/ssr"
import { Button } from "@/components/ui/button"
import { APP_NAME } from "@/lib/brand"
import { AvatarMenu } from "@/components/account/avatar-menu"
import { Greeting } from "@/components/dashboard/greeting"
import { HeroCard } from "@/components/dashboard/hero-card"
import { OtherWritings } from "@/components/dashboard/other-writings"
import { auth } from "@/auth"
import { getDashboardData } from "@/lib/dashboard"
import { getTrashCount } from "@/lib/trash"
import { getEntitlements } from "@/lib/entitlements"
import { getUnseenReaderComments } from "@/lib/dashboard"

export const metadata: Metadata = { title: "Your writings" }

export default async function DashboardPage() {
  const session = await auth()
  const [{ hero, others }, trashCount, plan, readerComments] = await Promise.all([
    getDashboardData(),
    session?.user?.id ? getTrashCount(session.user.id) : Promise.resolve(0),
    session?.user?.id ? getEntitlements(session.user.id).then((e) => e.plan) : Promise.resolve("free" as const),
    session?.user?.id ? getUnseenReaderComments(session.user.id) : Promise.resolve(null),
  ])
  const firstName = session?.user?.name?.split(" ")[0]

  return (
    <div className="dashboard-glow flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-6 py-5 sm:px-10">
        <Link href="/dashboard" className="flex items-center gap-2 text-foreground">
          <FeatherIcon className="size-4 text-primary" weight="duotone" />
          <span className="font-heading text-sm font-semibold">{APP_NAME}</span>
        </Link>
        <div className="flex items-center gap-3">
          {plan === "pro" ? (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Pro</span>
          ) : (
            <Button size="sm" variant="ghost" render={<Link href="/pricing" />} nativeButton={false}>
              Upgrade
            </Button>
          )}
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

          {readerComments ? (
            <Link
              href={readerComments.href}
              className="mb-6 flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-foreground hover:bg-primary/10"
            >
              <ChatTeardropTextIcon className="size-4 text-primary" />
              {readerComments.count === 1
                ? "A beta reader left you a comment."
                : `Beta readers left you ${readerComments.count} new comments.`}
              <span className="ml-auto text-xs text-primary">Read</span>
            </Link>
          ) : null}

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
