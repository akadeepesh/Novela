"use client"

import Link from "next/link"
import { PlusIcon } from "@phosphor-icons/react/dist/ssr"
import { Button } from "@/components/ui/button"

/**
 * "New …" button that only navigates to a blank form. Nothing is saved until
 * the person presses Create there, so just looking around never leaves
 * "New Character 3" records behind.
 */
export function NewLinkButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Button size="sm" nativeButton={false} render={<Link href={href} />}>
      <PlusIcon />
      {children}
    </Button>
  )
}
