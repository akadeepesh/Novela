import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { buildExportDocument } from "@/lib/export/build-document"
import { findActiveShare, isShareUnlocked, recordShareView } from "@/lib/share"
import { SharedReader } from "./shared-reader"
import { PasswordGate } from "./password-gate"

// A private link: keep it out of search engines, and don't leak the token
// to other sites through the Referer header.
export const metadata: Metadata = {
  title: "Shared draft",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
}

export default async function SharedBookPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const share = await findActiveShare(token)
  // Revoked, expired, unknown, or the project is in the Trash: all look the same.
  if (!share) notFound()

  if (!(await isShareUnlocked(share))) {
    return <PasswordGate token={token} title={share.project.title} />
  }

  await recordShareView(share.linkId)
  const doc = await buildExportDocument(share.project, share.ownerId, {
    includeTitlePage: true,
    includeTOC: true,
    includeSections: [],
  })

  return (
    <SharedReader
      token={token}
      allowComments={share.allowComments}
      doc={doc}
      projectType={share.project.type}
      manuscriptSettings={share.project.manuscriptSettings}
      coverFrontUrl={share.project.coverFrontUrl}
      coverBackUrl={share.project.coverBackUrl}
    />
  )
}
