"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { CopyIcon, CheckIcon, LockIcon, ChatTeardropTextIcon } from "@phosphor-icons/react/dist/ssr"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import type { SerializedShareLink } from "@/lib/share"
import { createShareLinkAction, listShareLinksAction, revokeShareLinkAction } from "@/app/actions/share"

const EXPIRY_OPTIONS = [
  { days: 0, label: "Never" },
  { days: 7, label: "In a week" },
  { days: 30, label: "In a month" },
  { days: 90, label: "In 3 months" },
]

function shareUrl(token: string) {
  return `${window.location.origin}/s/${token}`
}

/**
 * Private reading links for beta readers: no account needed to read, and
 * (on Pro) comments that land in the writer's editor.
 */
export function ShareCard({ projectId, proFeatures }: { projectId: string; proFeatures: boolean }) {
  const [links, setLinks] = useState<SerializedShareLink[] | null>(null)
  const [name, setName] = useState("")
  const [allowComments, setAllowComments] = useState(proFeatures)
  const [password, setPassword] = useState("")
  const [expiresInDays, setExpiresInDays] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void listShareLinksAction(projectId).then((result) => {
      if (cancelled) return
      if (result.ok) setLinks(result.links)
      else setError("Couldn't load your links.")
    })
    return () => {
      cancelled = true
    }
  }, [projectId])

  async function create() {
    setBusy(true)
    setError(null)
    const result = await createShareLinkAction(projectId, {
      name: name.trim() || undefined,
      allowComments: proFeatures ? allowComments : false,
      password: proFeatures && password ? password : undefined,
      expiresInDays: proFeatures && expiresInDays ? expiresInDays : undefined,
    }).catch(() => ({ ok: false as const, error: "Couldn't create the link." }))
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setLinks((prev) => [result.link, ...(prev ?? [])])
    setName("")
    setPassword("")
    void copy(result.link.token)
  }

  async function copy(token: string) {
    try {
      await navigator.clipboard.writeText(shareUrl(token))
      setCopied(token)
      setTimeout(() => setCopied((c) => (c === token ? null : c)), 2000)
    } catch {
      setError("Couldn't copy automatically. Select the link and copy it yourself.")
    }
  }

  async function revoke(link: SerializedShareLink) {
    setLinks((prev) => prev?.filter((l) => l.id !== link.id) ?? prev)
    const result = await revokeShareLinkAction(projectId, link.id).catch(() => ({ ok: false }))
    if (!result.ok) setError("Couldn't revoke that link. Reload the page and try again.")
  }

  return (
    <Card id="share">
      <CardHeader>
        <CardTitle className="text-base">Beta readers</CardTitle>
        <CardDescription>
          Share a private, read-only link. Readers don&apos;t need an account; they always see your latest saved text.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {links && links.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {links.map((link) => (
              <li key={link.id} className="flex flex-col gap-2 rounded-lg border border-border p-3">
                <div className="flex items-center gap-2">
                  <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                    {link.name || "Reader link"}
                  </p>
                  {link.allowComments ? (
                    <ChatTeardropTextIcon className="size-4 text-primary" aria-label="Comments on" />
                  ) : null}
                  {link.hasPassword ? <LockIcon className="size-4 text-primary" aria-label="Password protected" /> : null}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={typeof window === "undefined" ? `/s/${link.token}` : shareUrl(link.token)}
                    onFocus={(e) => e.currentTarget.select()}
                    aria-label="Share link"
                    className="h-8 min-w-0 flex-1 rounded-md border border-input bg-muted/40 px-2 text-xs text-muted-foreground"
                  />
                  <Button size="sm" variant="outline" onClick={() => copy(link.token)}>
                    {copied === link.token ? <CheckIcon /> : <CopyIcon />}
                    {copied === link.token ? "Copied" : "Copy"}
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => revoke(link)}>
                    Revoke
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Opened {link.viewCount} {link.viewCount === 1 ? "time" : "times"}
                  {link.expiresAt ? ` · stops working ${new Date(link.expiresAt).toLocaleDateString()}` : ""}
                </p>
              </li>
            ))}
          </ul>
        ) : links ? (
          <p className="text-sm text-muted-foreground">No links yet.</p>
        ) : null}

        <div className="flex flex-col gap-3 rounded-lg border border-dashed border-border p-3">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            placeholder="Who is it for? (optional, e.g. Writing group)"
          />
          <fieldset disabled={!proFeatures} className="flex flex-col gap-3 disabled:opacity-60">
            <label className="flex items-center gap-2 text-sm text-foreground">
              <Checkbox checked={allowComments} onCheckedChange={(c) => setAllowComments(c === true)} />
              Let readers leave comments
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                maxLength={100}
                placeholder="Password (optional)"
                autoComplete="new-password"
              />
              <select
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(Number(e.target.value))}
                aria-label="Link expires"
                className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
              >
                {EXPIRY_OPTIONS.map((o) => (
                  <option key={o.days} value={o.days}>
                    Expires: {o.label}
                  </option>
                ))}
              </select>
            </div>
          </fieldset>
          {!proFeatures ? (
            <p className="text-xs text-muted-foreground">
              Comments, passwords and expiry dates come with{" "}
              <Link href="/pricing" className="underline underline-offset-2">
                Pro
              </Link>
              .
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          ) : null}
          <Button className="w-fit" onClick={create} disabled={busy}>
            {busy ? "Creating…" : "Create link"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
