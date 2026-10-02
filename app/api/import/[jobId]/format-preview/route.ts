import { NextResponse } from "next/server";
import { loadPreviewJob } from "@/lib/import/dev-preview";
import { extractText } from "@/lib/import/extract/extract-text";
import { detectStructure } from "@/lib/import/structure/detect-structure";
import { parsePieceList } from "@/lib/import/structure/report";
import { formatBook } from "@/lib/import/format/build-format";
import { formatFormatReport } from "@/lib/import/format/report";
import { CHAPTER_LABEL_SINGULAR, PROJECT_TYPES, normalizeProjectType } from "@/lib/project-config";

export const maxDuration = 60;

/**
 * DEVELOPMENT ONLY — see extract-preview. Runs extraction, structure
 * detection and formatting reconstruction on one of your own in-flight
 * imports, using the book type and cover answer you gave in Step 2.
 *
 *   /api/import/<jobId>/format-preview                 → summary + every piece in one line + the lines it rejoined
 *   …?pieces=7                  → read piece 7 as rebuilt (also 1-10, or 1-3,9)
 *   …?type=novel&cover=0        → try a different book type / cover answer without redoing Step 2
 *   …?format=json&pieces=7      → the Tiptap JSON for those pieces (all pieces if none given)
 */
export async function GET(request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const loaded = await loadPreviewJob(jobId);
  if (!loaded.ok) return loaded.response;
  const { job } = loaded;

  const url = new URL(request.url);
  const typeParam = url.searchParams.get("type");
  const projectType = normalizeProjectType(
    (PROJECT_TYPES.some((t) => t.value === typeParam) ? typeParam : job.projectType) ?? "custom"
  );
  const coverParam = url.searchParams.get("cover");
  const hasFrontCover = coverParam === null ? job.hasFrontCover ?? false : coverParam === "1";

  try {
    const extracted = await extractText(job.bytes);
    const structure = detectStructure(extracted, {
      projectType,
      hasFrontCover,
      fallbackTitle: job.fileName.replace(/\.pdf$/i, ""),
      bareNumberLabel: CHAPTER_LABEL_SINGULAR[projectType],
    });
    const book = formatBook(extracted, structure);
    const pieces = parsePieceList(url.searchParams.get("pieces"), book.pieces.length);

    if (url.searchParams.get("format") === "json") {
      const chosen = pieces.length ? pieces.map((n) => book.pieces[n - 1]) : book.pieces;
      return NextResponse.json({ ...book, pieces: chosen }, { headers: { "Cache-Control": "no-store" } });
    }
    return new NextResponse(formatFormatReport(book, { fileName: job.fileName, pieces }), {
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("format-preview failed", err);
    return new NextResponse("Formatting failed — see the server log.", { status: 500 });
  }
}
