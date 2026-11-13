import type { Metadata } from "next"
import Link from "next/link"
import { APP_NAME } from "@/lib/brand"
import { LegalPage } from "@/components/marketing/legal-page"

export const metadata: Metadata = {
  title: "Terms",
  description: `The terms for using ${APP_NAME}.`,
  alternates: { canonical: "/terms" },
}

const UPDATED = "14 November 2026"

export default function TermsPage() {
  return (
    <LegalPage title="Terms" updated={UPDATED}>
      <p>By using {APP_NAME} you agree to these terms. They&apos;re short because the app is simple.</p>

      <h2>Your work is yours</h2>
      <p>
        Everything you write in {APP_NAME} belongs to you. We claim no rights to it, and we can&apos;t see it: it is
        stored on your device. See the <Link href="/privacy">privacy page</Link>.
      </p>

      <h2>Keep backups</h2>
      <p>
        Because your books live in your browser, they can be lost if you clear your browser&apos;s data, lose or
        reset your device, or your browser deletes storage. You are responsible for keeping backups. The app helps
        with backup files and folder backup, but we cannot recover books for you.
      </p>

      <h2>The app is provided as is</h2>
      <p>
        {APP_NAME} is free and provided &quot;as is&quot;, without warranties of any kind. Story Check, the style
        checks and the print export are aids, not guarantees. Always check your book yourself, and check printed
        files with your printer&apos;s previewer and a proof copy before publishing. To the extent the law allows,
        we aren&apos;t liable for lost work, rejected files or any other loss from using the app.
      </p>

      <h2>Template packs</h2>
      <p>
        Paid template packs, when available, are sold through a third-party store whose terms cover the purchase.
        Fonts and images in a pack come with their own licences, listed in the pack.
      </p>

      <h2>Fair use of the service</h2>
      <p>Don&apos;t use the link preview to attack or overload other websites, or try to break the site.</p>

      <h2>Changes</h2>
      <p>We may update these terms. The date at the top shows the latest version.</p>
    </LegalPage>
  )
}
