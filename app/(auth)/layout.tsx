import { FeatherIcon } from "@phosphor-icons/react/dist/ssr"
import Link from "next/link"

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center bg-secondary/40 px-6 py-16">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
            <FeatherIcon className="size-4" weight="duotone" />
          </span>
          <span className="font-heading text-base font-semibold text-foreground">Inkwell</span>
        </Link>
        {children}
      </div>
    </div>
  )
}
