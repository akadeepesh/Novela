import { NextResponse } from "next/server";
import { loadPreviewJob } from "@/lib/import/dev-preview";
import { extractText } from "@/lib/import/extract/extract-text";
import { detectStructure } from "@/lib/import/structure/detect-structure";
import { extractBackground } from "@/lib/import/background/extract-background";
import { recurringFurnitureBoxes } from "@/lib/import/background/furniture-boxes";
import { formatBackgroundReport } from "@/lib/import/background/report";
import { CHAPTER_LABEL_SINGULAR, PROJECT_TYPES, normalizeProjectType } from "@/lib/project-config";

// Stacking 40 rendered pages is the slowest step of the whole import.
export const maxDuration = 120;

/**
 * DEVELOPMENT ONLY — see extract-preview. Pulls the page background out of
 * one of your own in-flight imports.
 *
 *   /api/import/<jobId>/background-preview              → a readable report
 *   …?view=image                                         → the extracted picture itself (open it in a tab)
 *   …?view=flat                                          → a swatch of the flat-colour fallback
 *   …?embedded=0                                         → skip the "picture already in the file" check and always stack pages
 *   …?samples=12                                         → stack only this many pages (see how a short book would fare)
 *   …?cover=1                                            → treat page 1 as a cover (default: your Step 2 answer)
 */
export async function GET(request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const loaded = await loadPreviewJob(jobId);
  if (!loaded.ok) return loaded.response;
  const { job } = loaded;

  const url = new URL(request.url);
  const coverParam = url.searchParams.get("cover");
  const hasFrontCover = coverParam === null ? job.hasFrontCover ?? false : coverParam === "1";
  const typeParam = url.searchParams.get("type");
  const projectType = normalizeProjectType(
    (PROJECT_TYPES.some((t) => t.value === typeParam) ? typeParam : job.projectType) ?? "custom"
  );
  const samplesParam = Number(url.searchParams.get("samples"));
  const maxSamples = Number.isFinite(samplesParam) && samplesParam >= 1 ? Math.min(40, Math.floor(samplesParam)) : undefined;

  try {
    const started = Date.now();
    // Step 4's page-number finder tells the background stage which marks sit in the same place on every page.
    const extracted = await extractText(job.bytes.slice());
    const structure = detectStructure(extracted, {
      projectType,
      hasFrontCover,
      fallbackTitle: job.fileName.replace(/\.pdf$/i, ""),
      bareNumberLabel: CHAPTER_LABEL_SINGULAR[projectType],
    });
    const result = await extractBackground(job.bytes.slice(), {
      hasFrontCover,
      recurringMarks: recurringFurnitureBoxes(extracted, structure),
      skipEmbedded: url.searchParams.get("embedded") === "0",
      maxSamples,
    });

    const view = url.searchParams.get("view");
    if (view === "image") {
      if (!result.image) return new NextResponse("No picture was extracted — a flat colour is all this book needs.", { status: 404 });
      return new NextResponse(Buffer.from(result.image.bytes), {
        headers: { "Content-Type": result.image.mime, "Cache-Control": "no-store" },
      });
    }
    if (view === "flat") {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="432" height="648"><rect width="100%" height="100%" fill="${result.flatColor.hex}"/></svg>`;
      return new NextResponse(svg, { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "no-store" } });
    }
    return new NextResponse(formatBackgroundReport(result, { fileName: job.fileName, ms: Date.now() - started }), {
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("background-preview failed", err);
    return new NextResponse("Background extraction failed — see the server log.", { status: 500 });
  }
}
