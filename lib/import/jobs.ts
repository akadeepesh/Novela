import "server-only";
import { cache } from "react";
import { connectDB } from "@/lib/db";
import { ImportJob } from "@/lib/models/import-job";
import { requireUserId } from "@/lib/projects";
import { normalizeProjectType, type ProjectType } from "@/lib/project-config";
import type { IntakeReport } from "@/lib/import/config";
import { RUN_STALE_AFTER_MS, freshRun, type ImportAssets, type ImportSummary, type RunState } from "@/lib/import/pipeline/types";

export type SerializedImportJob = {
  id: string;
  status: "intake-passed" | "intent-set" | "processing" | "processed" | "committing";
  fileName: string;
  fileSize: number;
  intake: IntakeReport;
  /** Unset until the person has answered — see the model comment. */
  projectType?: ProjectType;
  hasFrontCover?: boolean;
  /** Live pipeline progress — present once the person has started the import. */
  run?: RunState;
  summary?: ImportSummary;
  assets?: ImportAssets;
};

/**
 * A run that stopped reporting (the server was restarted, the function timed
 * out) would otherwise sit on "running" forever. Reads treat it as failed,
 * so the person gets a way forward instead of a screen that never changes.
 */
export function effectiveRun(
  run: RunState | undefined,
  ctx: { status?: string; updatedAt?: Date; hasFrontCover?: boolean } = {}
): RunState | undefined {
  const failed = (message: string): RunState => ({
    ...freshRun(ctx.hasFrontCover === true),
    phase: "failed",
    error: { message },
  });

  if (!run) {
    // "Processed" with no record of the run means its results were never saved —
    // better to say so (and offer a retry) than to show a screen that never moves.
    if (ctx.status === "processed") return failed("The import finished but its results weren’t saved. Nothing was lost — try again.");
    // "Processing" with no report at all: fine for the first moment, a failure if it never starts.
    if (ctx.status === "processing" && ctx.updatedAt && Date.now() - ctx.updatedAt.getTime() > RUN_STALE_AFTER_MS) {
      return failed("The import never got started — the server may have been interrupted. Try again.");
    }
    return undefined;
  }
  if (run.phase !== "running") return run;
  if (Date.now() - run.updatedAt <= RUN_STALE_AFTER_MS) return run;
  return {
    ...run,
    phase: "failed",
    error: { message: "The import stopped partway — the server was interrupted. Nothing was saved; you can try again." },
  };
}

/**
 * Loads one of the signed-in person's import jobs. Returns null (not a 404)
 * when it's missing, malformed, or someone else's: jobs expire by design,
 * so "gone" is an expected state with its own friendly screen, not an error.
 */
export const getImportJob = cache(async (jobId: string): Promise<SerializedImportJob | null> => {
  const userId = await requireUserId();
  await connectDB();

  let doc: Record<string, unknown> | null;
  try {
    doc = await ImportJob.findOne({ _id: jobId, ownerId: userId }).lean<Record<string, unknown>>();
  } catch {
    return null; // malformed ObjectId
  }
  if (!doc) return null;

  const intake = doc.intake as IntakeReport;
  return {
    id: String(doc._id),
    status: (doc.status as SerializedImportJob["status"]) ?? "intake-passed",
    fileName: (doc.fileName as string) ?? "",
    fileSize: (doc.fileSize as number) ?? 0,
    intake: {
      pageCount: intake.pageCount,
      textPages: intake.textPages,
      imageOnlyPages: intake.imageOnlyPages,
      imageOnlyApproximate: !!intake.imageOnlyApproximate,
      blankPages: intake.blankPages,
      encrypted: !!intake.encrypted,
    },
    projectType: doc.projectType ? normalizeProjectType(doc.projectType as string) : undefined,
    hasFrontCover: typeof doc.hasFrontCover === "boolean" ? doc.hasFrontCover : undefined,
    run: effectiveRun(doc.run as RunState | undefined, {
      status: doc.status as string | undefined,
      updatedAt: doc.updatedAt as Date | undefined,
      hasFrontCover: doc.hasFrontCover === true,
    }),
    summary: doc.summary as ImportSummary | undefined,
    assets: {
      background: !!(doc.assets as { backgroundPathname?: string } | undefined)?.backgroundPathname,
      cover: !!(doc.assets as { coverPathname?: string } | undefined)?.coverPathname,
    },
  };
});
