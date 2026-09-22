import { FeatherIcon } from "@phosphor-icons/react/dist/ssr"
import Link from "next/link"
import { AuthBrandPanel } from "@/components/auth/auth-brand-panel"

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <AuthBrandPanel />

      <div className="flex flex-1 items-center justify-center px-6 py-16 lg:px-12">
        <div className="w-full max-w-sm">
          <Link href="/" className="mb-8 flex items-center justify-center gap-2 lg:hidden">
            <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
              <FeatherIcon className="size-4" weight="duotone" />
            </span>
            <span className="font-heading text-base font-semibold text-foreground">KoraKagaj</span>
          </Link>
          {children}
        </div>
      </div>
    </div>
  )
}
