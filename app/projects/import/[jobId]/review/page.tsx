import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { loadReview } from "@/lib/import/review/load"
import { ImportSteps } from "../../import-steps"
import { ReviewScreen } from "./review-screen"

export const metadata: Metadata = { title: "Review your book" }

export default async function ImportReviewPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params
  const loaded = await loadReview(jobId)

  if (!loaded.ok) {
    if (loaded.reason === "not-ready") redirect(`/projects/import/${jobId}`)
    if (loaded.reason === "missing") notFound()
    // The pipeline said it finished but its results can't be found — back to the progress screen, which offers a retry.
    redirect(`/projects/import/${jobId}`)
  }

  const { job, state, background, hasCover, assetVersion } = loaded.payload
  return (
    <ReviewScreen
      jobId={job.id}
      fileName={job.fileName}
      projectType={job.projectType ?? "custom"}
      hasCoverAnswer={job.hasFrontCover === true}
      initial={state}
      background={background}
      hasCover={hasCover}
      assetVersion={assetVersion}
      steps={<ImportSteps current={3} />}
    />
  )
}
