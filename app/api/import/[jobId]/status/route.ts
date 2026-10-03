import { NextResponse } from "next/server";
import { getImportJob } from "@/lib/import/jobs";

/** What the progress screen polls: the job's live run, summary and which pictures exist. */
export async function GET(_request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  let job;
  try {
    job = await getImportJob(jobId);
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!job) return NextResponse.json({ error: "gone" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  return NextResponse.json(
    { status: job.status, run: job.run ?? null, summary: job.summary ?? null, assets: job.assets ?? { background: false, cover: false } },
    { headers: { "Cache-Control": "no-store" } }
  );
}
