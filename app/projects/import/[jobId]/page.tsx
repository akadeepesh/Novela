import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeftIcon } from "@phosphor-icons/react/dist/ssr"
import { Button } from "@/components/ui/button"
import { getImportJob } from "@/lib/import/jobs"
import { ImportSteps } from "../import-steps"
import { ImportIntent } from "./import-intent"
import { ImportProgress } from "./import-progress"

export const metadata: Metadata = { title: "Importing your book" }

// The pipeline runs after the "Start importing" response, in this route's function — give it room.
export const maxDuration = 300

export default async function ImportJobPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params
  const job = await getImportJob(jobId)

  // Imports are scratch space and expire on their own — so "gone" is a
  // normal thing to land on (an old tab, a next-day return), not an error.
  if (!job) {
    return (
      <div className="flex min-h-screen flex-col bg-manuscript-bg text-manuscript-fg">
        <div className="p-6">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1 text-sm opacity-60 transition-opacity hover:opacity-100"
          >
            <ArrowLeftIcon className="size-3.5" />
            Dashboard
          </Link>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 pb-32 text-center">
          <h1 className="font-serif text-3xl font-medium">This import has expired</h1>
          <p className="max-w-sm text-sm leading-relaxed opacity-60">
            Uploads are only kept for a day, and this one is gone. Nothing of yours was lost — upload the
            PDF again and pick up from the start.
          </p>
          <Button className="mt-2" render={<Link href="/projects/import" />} nativeButton={false}>
            Upload a PDF
          </Button>
        </div>
      </div>
    )
  }

  if (job.status === "processing" || job.status === "processed") {
    return <ImportProgress job={job} steps={<ImportSteps current={2} />} />
  }

  return <ImportIntent job={job} steps={<ImportSteps current={1} />} />
}
