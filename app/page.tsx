import { BookOpenTextIcon, FeatherIcon } from "@phosphor-icons/react/dist/ssr"
import Link from "next/link"
import { Button } from "@/components/ui/button"

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
          KoraKagaj is a focused workspace for novels, poetry, and everything
          in between — manuscript, characters, world, and plot, all in one
          quiet place.
        </p>

        <div className="mt-2 flex items-center gap-3">
          <Button size="lg" render={<Link href="/signup" />} nativeButton={false}>
            <BookOpenTextIcon />
            Start writing
          </Button>
          <Button size="lg" variant="outline" render={<Link href="/login" />} nativeButton={false}>
            Sign in
          </Button>
        </div>
        <Link href="/pricing" className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
          Free to write. See pricing
        </Link>
      </div>
    </div>
  )
}
