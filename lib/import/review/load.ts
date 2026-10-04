import "server-only";
import { connectDB } from "@/lib/db";
import { ImportJob } from "@/lib/models/import-job";
import { requireUserId } from "@/lib/projects";
import { getImportJob, type SerializedImportJob } from "@/lib/import/jobs";
import { importFilePath, readImportJson } from "@/lib/import/pipeline/store";
import type { StructureResult } from "@/lib/import/structure/types";
import type { FormattedBook } from "@/lib/import/format/types";
import type { BackgroundResult } from "@/lib/import/background/types";
import { buildInitialReview } from "./build-initial";
import { sanitizeReviewState } from "./sanitize";
import type { BackgroundInfo, ReviewState } from "./types";

export type ReviewPayload = {
  job: SerializedImportJob;
  state: ReviewState;
  background: BackgroundInfo | null;
  hasCover: boolean;
  /** Cache-buster for the background picture, so a saved touch-up shows straight away. */
  assetVersion: number;
};

export type ReviewLoad =
  | { ok: true; payload: ReviewPayload }
  | { ok: false; reason: "missing" | "not-ready" | "no-results" };

/**
 * Everything the review screen opens with: the saved working copy if there is
 * one, otherwise a fresh one built from what the pipeline produced.
 */
export async function loadReview(jobId: string): Promise<ReviewLoad> {
  const job = await getImportJob(jobId);
  if (!job) return { ok: false, reason: "missing" };
  if (job.status !== "processed" || job.run?.phase !== "done") return { ok: false, reason: "not-ready" };

  const userId = await requireUserId();
  await connectDB();
  const raw = await ImportJob.findOne({ _id: jobId, ownerId: userId })
    .select("review assets updatedAt")
    .lean<{ review?: unknown; assets?: Record<string, string | undefined>; updatedAt?: Date }>();
  if (!raw) return { ok: false, reason: "missing" };

  const backgroundJson = await readImportJson<Omit<BackgroundResult, "image">>(importFilePath(userId, jobId, "background.json")).catch(() => null);
  const hasImage = !!raw.assets?.backgroundPathname;
  const hasCover = !!raw.assets?.coverPathname;
  const background: BackgroundInfo | null = backgroundJson
    ? {
        method: backgroundJson.method,
        quality: backgroundJson.quality,
        recommendation: backgroundJson.recommendation,
        flatColor: backgroundJson.flatColor,
        notes: backgroundJson.notes ?? [],
        hasImage,
        touchedUp: !!raw.assets?.backgroundEditedPathname,
      }
    : null;

  let state = raw.review ? sanitizeReviewState(raw.review) : null;
  if (!state) {
    const result = raw.assets?.resultPathname ? await readImportJson<{ structure: StructureResult; formatted: FormattedBook }>(raw.assets.resultPathname) : null;
    if (!result) return { ok: false, reason: "no-results" };
    state = buildInitialReview(result.formatted, { fileName: job.fileName, background, hasCover });
  }
  if (!hasCover) state = { ...state, useCover: false };
  if (!hasImage && state.background.kind === "image") state = { ...state, background: { kind: "preset", id: background?.flatColor.dark ? "midnight" : "cream" } };

  return { ok: true, payload: { job, state, background, hasCover, assetVersion: raw.updatedAt?.getTime() ?? Date.now() } };
}
