import type { Metadata } from "next"
import { APP_NAME, CONTACT_EMAIL } from "@/lib/brand"
import { LegalPage } from "@/components/marketing/legal-page"

export const metadata: Metadata = {
  title: "Privacy",
  description: `How ${APP_NAME} handles your data: your writing stays in your browser on your device and is never sent to us.`,
  alternates: { canonical: "/privacy" },
}

/** Keep in step with what the app really does; see docs/launch-checklist.md. */
const UPDATED = "14 November 2026"

export default function PrivacyPage() {
  const analytics = Boolean(process.env.NEXT_PUBLIC_ANALYTICS_SRC && process.env.NEXT_PUBLIC_ANALYTICS_DOMAIN)
  return (
    <LegalPage title="Privacy" updated={UPDATED}>
      <p>
        The short version: <strong>your writing never leaves your device.</strong> {APP_NAME} has no accounts,
        no database of books and no way to read what you write.
      </p>

      <h2>What stays on your device</h2>
      <p>
        Your books, chapters, versions, story bible, notes, research, comments, images, settings, word counts and
        imported templates are stored in your browser&apos;s own storage (IndexedDB) on the device you use. They are
        not sent to us or to anyone else. Clearing your browser&apos;s site data deletes them, so keep backups.
      </p>
      <p>
        Backup and project files are made in your browser and saved where you choose. If you turn on folder backup,
        your browser writes to the folder you picked. If that folder is synced (for example by Dropbox or Google
        Drive), that service&apos;s own privacy terms apply to the copies it holds.
      </p>

      <h2>The one network request with something you entered</h2>
      <p>
        When you paste a link into Research, the app sends <strong>that link only</strong> to our server, which
        fetches the page to show its title, image and icon. The link is not stored. Nothing else you write is ever
        part of that request.
      </p>

      <h2>What our server sees</h2>
      <p>
        Like any website, the server that delivers the app receives standard request information (your IP address,
        browser type and the page requested) when you load it. Our hosting provider may keep this in short-lived logs
        for security and reliability. We don&apos;t use it to identify you.
      </p>

      <h2>Analytics</h2>
      {analytics ? (
        <p>
          On public pages only (this site&apos;s home page, guides and legal pages) we count visits with a
          cookieless analytics service. It records the page, the referring site, and the browser, device type and
          country, without cookies and without a personal identifier. It is never loaded inside the writing app.
        </p>
      ) : (
        <p>We don&apos;t run any analytics or tracking.</p>
      )}

      <h2>Cookies</h2>
      <p>
        {APP_NAME} sets no cookies for tracking or advertising. Your browser stores your theme choice and the app&apos;s
        offline files locally.
      </p>

      <h2>No AI</h2>
      <p>
        Your text is never sent to an AI service, and it is never used to train one. Story Check and the style checks
        run entirely in your browser.
      </p>

      <h2>Children</h2>
      <p>The app collects no personal information from anyone, including children.</p>

      <h2>Changes</h2>
      <p>If this changes, we&apos;ll update this page and the date at the top.</p>

      {CONTACT_EMAIL ? (
        <>
          <h2>Contact</h2>
          <p>
            Questions? Email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
          </p>
        </>
      ) : null}
    </LegalPage>
  )
}
