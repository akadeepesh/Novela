import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeftIcon } from "@phosphor-icons/react/dist/ssr"
import { PageShell, PageShellHeader, PageShellTitle, PageShellDescription } from "@/components/layout/page-shell"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { connectDB } from "@/lib/db"
import { User } from "@/lib/models/user"
import { Project } from "@/lib/models/project"
import { requireUserId } from "@/lib/projects"
import { getEntitlements } from "@/lib/entitlements"
import { PLANS } from "@/lib/plans"
import { BillingPanel } from "./billing-panel"

export const metadata: Metadata = { title: "Settings" }

const MB = 1024 * 1024

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * MB) return `${(bytes / (1024 * MB)).toFixed(1)} GB`
  return `${(bytes / MB).toFixed(bytes < 10 * MB ? 1 : 0)} MB`
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>
}) {
  const userId = await requireUserId()
  const { checkout } = await searchParams
  const [{ plan, features, billing, storageBytesUsed }, user, activeProjects] = await Promise.all([
    getEntitlements(userId),
    connectDB().then(() =>
      User.findById(userId).select("name email provider").lean<{ name: string; email: string; provider?: string }>()
    ),
    connectDB().then(() => Project.countDocuments({ ownerId: userId, deletedAt: null })),
  ])

  const renewsOn = billing?.currentPeriodEnd
    ? new Date(billing.currentPeriodEnd).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })
    : null

  return (
    <PageShell width="prose">
      <Link
        href="/dashboard"
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-3.5" />
        Dashboard
      </Link>
      <PageShellHeader>
        <PageShellTitle>Settings</PageShellTitle>
        <PageShellDescription>Your account, plan and usage.</PageShellDescription>
      </PageShellHeader>

      <div className="flex flex-col gap-6">
        {checkout === "success" || checkout === "processing" ? (
          <p role="status" className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-foreground">
            {plan === "pro"
              ? "Welcome to Pro. Thank you for supporting KoraKagaj!"
              : "Payment received. Pro will switch on in a moment; refresh this page if it doesn't."}
          </p>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Account</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm">
            <p className="text-foreground">{user?.name}</p>
            <p className="text-muted-foreground">{user?.email}</p>
            <p className="text-xs text-muted-foreground">
              Signed in with {user?.provider === "google" ? "Google" : "email and password"}.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Plan: {PLANS[plan].name}</CardTitle>
            <CardDescription>
              Limits only ever stop you creating more. Editing, deleting and exporting always work.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BillingPanel
              plan={plan}
              provider={billing?.provider ?? null}
              status={billing?.status ?? null}
              renewsOn={renewsOn}
              cancelAtPeriodEnd={billing?.cancelAtPeriodEnd ?? false}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Usage</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Meter label="Active books" used={activeProjects} total={features.limits.projects} format={String} />
            <Meter label="Image storage" used={storageBytesUsed} total={features.storageBytes} format={formatBytes} />
          </CardContent>
        </Card>
      </div>
    </PageShell>
  )
}

function Meter({
  label,
  used,
  total,
  format,
}: {
  label: string
  used: number
  total: number
  format: (n: number) => string
}) {
  const percent = Math.min(100, Math.round((used / total) * 100))
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-foreground">{label}</span>
        <span className="text-muted-foreground">
          {format(used)} of {format(total)}
        </span>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label={label}
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}
