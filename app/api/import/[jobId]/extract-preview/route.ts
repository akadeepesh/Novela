import { NextResponse } from "next/server";
import { loadPreviewJob } from "@/lib/import/dev-preview";
import { extractText } from "@/lib/import/extract/extract-text";
import { formatExtractionReport, parsePageList } from "@/lib/import/extract/report";

// Reads a whole book; give it the same headroom as the upload page.
export const maxDuration = 60;

/**
 * DEVELOPMENT ONLY. Runs text extraction on one of your own in-flight
 * imports and returns what it found, so a real PDF can be checked against
 * what the engine made of it. It isn't part of the product: the screens a
 * person sees come later, and this route is removed once the import
 * pipeline's own progress and review screens exist.
 *
 *   /api/import/<jobId>/extract-preview                → report, pages 1–3
 *   /api/import/<jobId>/extract-preview?pages=1,40-42  → those pages
 *   /api/import/<jobId>/extract-preview?format=json    → profile + chosen pages as JSON
 *
 * <jobId> is the last segment of the "About your book" page's URL.
 */
export async function GET(request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const loaded = await loadPreviewJob(jobId);
  if (!loaded.ok) return loaded.response;
  const { job } = loaded;

  const url = new URL(request.url);
  try {
    const result = await extractText(job.bytes);
    const requested = parsePageList(url.searchParams.get("pages"), result.pageCount);
    const pages = requested.length ? requested : [1, 2, 3].filter((p) => p <= result.pageCount);

    if (url.searchParams.get("format") === "json") {
      return NextResponse.json(
        { profile: result.profile, elapsedMs: result.elapsedMs, pages: pages.map((p) => result.pages[p - 1]) },
        { headers: { "Cache-Control": "no-store" } }
      );
    }
    return new NextResponse(formatExtractionReport(result, { fileName: job.fileName, pages }), {
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("extract-preview failed", err);
    return new NextResponse("Extraction failed — see the server log.", { status: 500 });
  }
}
