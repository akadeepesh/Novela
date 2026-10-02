import { NextResponse } from "next/server";
import { loadPreviewJob } from "@/lib/import/dev-preview";
import { extractText } from "@/lib/import/extract/extract-text";
import { detectStructure } from "@/lib/import/structure/detect-structure";
import { formatStructureReport, parsePieceList } from "@/lib/import/structure/report";
import { CHAPTER_LABEL_SINGULAR, PROJECT_TYPES, normalizeProjectType } from "@/lib/project-config";

export const maxDuration = 60;

/**
 * DEVELOPMENT ONLY — see extract-preview. Runs extraction and then
 * structure detection on one of your own in-flight imports, using the book
 * type and cover answer you gave in Step 2.
 *
 *   /api/import/<jobId>/structure-preview                   → report
 *   …?pieces=1-30            → list those pieces
 *   …?detail=1               → also show each listed piece's first and last line
 *   …?type=novel&cover=0     → try a different book type / cover answer without redoing Step 2
 *   …?format=json            → the full result as JSON
 */
export async function GET(request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const loaded = await loadPreviewJob(jobId);
  if (!loaded.ok) return loaded.response;
  const { job } = loaded;

  const url = new URL(request.url);
  const typeParam = url.searchParams.get("type");
  // Step 2's answer, unless overridden. "custom" (try everything) if neither exists.
  const projectType = normalizeProjectType(
    (PROJECT_TYPES.some((t) => t.value === typeParam) ? typeParam : job.projectType) ?? "custom"
  );
  const coverParam = url.searchParams.get("cover");
  const hasFrontCover = coverParam === null ? job.hasFrontCover ?? false : coverParam === "1";

  try {
    const extracted = await extractText(job.bytes);
    const result = detectStructure(extracted, {
      projectType,
      hasFrontCover,
      fallbackTitle: job.fileName.replace(/\.pdf$/i, ""),
      bareNumberLabel: CHAPTER_LABEL_SINGULAR[projectType],
    });

    if (url.searchParams.get("format") === "json") {
      return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
    }
    const pieces = parsePieceList(url.searchParams.get("pieces"), result.pieces.length);
    return new NextResponse(
      formatStructureReport(result, extracted, {
        fileName: job.fileName,
        pieces,
        detail: url.searchParams.get("detail") === "1",
      }),
      { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("structure-preview failed", err);
    return new NextResponse("Structure detection failed — see the server log.", { status: 500 });
  }
}
