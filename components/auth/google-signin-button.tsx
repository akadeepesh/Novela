"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { GoogleLogoIcon } from "@phosphor-icons/react/dist/ssr"
import { Button } from "@/components/ui/button"

export function GoogleSignInButton() {
  const [pending, setPending] = useState(false)

  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      disabled={pending}
      onClick={() => {
        setPending(true)
        void signIn("google", { callbackUrl: "/dashboard" })
      }}
    >
      <GoogleLogoIcon weight="bold" />
      {pending ? "Redirecting…" : "Continue with Google"}
    </Button>
  )
}
