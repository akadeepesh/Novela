"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { LockIcon } from "@phosphor-icons/react/dist/ssr"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { unlockShareAction } from "./actions"

export function PasswordGate({ token, title }: { token: string; title: string }) {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const result = await unlockShareAction(token, password).catch(() => ({
      ok: false as const,
      error: "Something went wrong. Please try again.",
    }))
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    router.refresh()
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <form onSubmit={submit} className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-xs">
        <div className="flex size-10 items-center justify-center rounded-full bg-muted text-primary">
          <LockIcon className="size-5" />
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-lg font-semibold text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground">The writer protected this draft with a password.</p>
        </div>
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          aria-label="Password"
          autoFocus
          maxLength={100}
        />
        {error ? (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        ) : null}
        <Button type="submit" disabled={busy || !password}>
          {busy ? "Checking…" : "Open"}
        </Button>
      </form>
    </div>
  )
}
