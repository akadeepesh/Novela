import { BookOpenTextIcon, FeatherIcon } from "@phosphor-icons/react/dist/ssr"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { APP_NAME } from "@/lib/brand"

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-background px-6">
      <div className="flex max-w-xl flex-col items-center gap-6 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted text-primary">
          <FeatherIcon className="size-5" weight="duotone" />
        </div>

        <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          A calmer place to write your book.
        </h1>

        <p className="font-serif text-lg leading-relaxed text-muted-foreground">
          {APP_NAME} is a focused workspace for novels, poetry, and everything
          in between — manuscript, characters, world, and plot, all in one
          quiet place.
        </p>

        <div className="mt-2 flex items-center gap-3">
          <Button size="lg" render={<Link href="/dashboard" />} nativeButton={false}>
            <BookOpenTextIcon />
            Start writing
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Free. No account. Your writing stays on your device.
        </p>
      </div>
    </div>
  )
}
