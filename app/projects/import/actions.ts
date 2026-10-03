"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { connectDB } from "@/lib/db";
import { ImportJob } from "@/lib/models/import-job";
import { requireUserId } from "@/lib/projects";
import { PROJECT_TYPES } from "@/lib/project-config";
import { IMPORT_JOB_TTL_MS, rejection, type IntakeRejection, type IntakeReport } from "@/lib/import/config";
import { inspectPdf } from "@/lib/import/inspect-pdf";
import { deleteImportBlob, isOwnedImportPathname, readImportBlob } from "@/lib/import/storage";
import { runImportPipeline } from "@/lib/import/pipeline/run-pipeline";
import { RUN_STALE_AFTER_MS, type RunState } from "@/lib/import/pipeline/types";

export type IntakeActionResult =
  | { ok: true; jobId: string; report: IntakeReport }
  | ({ ok: false } & IntakeRejection);

/**
 * Runs after the browser has finished uploading a PDF to scratch Blob
 * storage. Reads it back, decides whether the pipeline can handle it, and —
 * only if so — opens an ImportJob for the later steps to build on. A
 * rejected file's blob is deleted immediately; nothing lingers.
 */
export async function runIntakeAction(input: {
  pathname: string;
  fileName: string;
}): Promise<IntakeActionResult> {
  const userId = await requireUserId();

  // Only ever touch this user's own scratch files.
  if (!isOwnedImportPathname(input?.pathname, userId)) {
    return { ok: false, ...rejection("upload-invalid") };
  }
  const pathname = input.pathname;

  try {
    // Don't trust the client's idea of the size — check what actually arrived.
    const read = await readImportBlob(pathname);
    if (!read.ok) {
      await deleteImportBlob(pathname);
      return { ok: false, ...rejection(read.reason === "too-large" ? "too-large" : "upload-invalid") };
    }
    const fileSize = read.bytes.length;

    const result = await inspectPdf(read.bytes);
    if (!result.ok) {
      await deleteImportBlob(pathname);
      const { ok: _ok, ...rest } = result;
      void _ok;
      return { ok: false, ...rest };
    }

    await connectDB();
    const job = await ImportJob.create({
      ownerId: userId,
      sourcePathname: pathname,
      fileName: String(input.fileName ?? "").slice(0, 255),
      fileSize,
      intake: result.report,
    });

    return { ok: true, jobId: String(job._id), report: result.report };
  } catch (err) {
    console.error("runIntakeAction failed", err);
    await deleteImportBlob(pathname);
    return { ok: false, ...rejection("upload-invalid") };
  }
}

/** "Choose a different file" after a passing intake — drops the job and its scratch PDF. */
export async function discardImportAction(jobId: string): Promise<{ ok: boolean }> {
  const userId = await requireUserId();
  try {
    await connectDB();
    const job = await ImportJob.findOneAndDelete({ _id: jobId, ownerId: userId }).lean<
      Record<string, unknown>
    >();
    if (!job) return { ok: false };
    await deleteImportBlob(job.sourcePathname as string);
    const assets = (job.assets ?? {}) as Record<string, string | undefined>;
    for (const key of ["textPathname", "resultPathname", "backgroundPathname", "coverPathname"]) {
      await deleteImportBlob(assets[key]);
    }
    return { ok: true };
  } catch {
    // Malformed id or a transient DB error — the job's TTL will reap the record regardless.
    return { ok: false };
  }
}

const intentSchema = z.object({
  projectType: z.enum(PROJECT_TYPES.map((t) => t.value) as [string, ...string[]]),
  hasFrontCover: z.boolean(),
});
export type ImportIntentInput = z.infer<typeof intentSchema>;

/**
 * Step 2: what kind of book this is, and whether page 1 is its cover. Both
 * are explicit answers — nothing here is guessed — and both steer later
 * steps (boundary detection, cover extraction). Also pushes the job's
 * expiry out again, since the person is clearly still here.
 */
export async function saveImportIntentAction(
  jobId: string,
  input: ImportIntentInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const userId = await requireUserId();

  const parsed = intentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Answer both questions to continue." };

  try {
    await connectDB();
    const result = await ImportJob.updateOne(
      { _id: jobId, ownerId: userId },
      {
        $set: {
          ...parsed.data,
          status: "intent-set",
          expiresAt: new Date(Date.now() + IMPORT_JOB_TTL_MS),
        },
      }
    );
    if (result.matchedCount === 0) {
      return { ok: false, error: "This import has expired — upload the PDF again to start over." };
    }
  } catch (err) {
    console.error("saveImportIntentAction failed", err);
    return { ok: false, error: "Couldn’t save that just now — try again." };
  }

  revalidatePath(`/projects/import/${jobId}`);
  return { ok: true };
}

/**
 * Starts (or restarts, after a failure) the import pipeline for a job whose
 * questions are answered. Returns straight away — the work runs after the
 * response, and the progress screen follows it by polling the job's `run`.
 *
 * The claim is atomic: only a job that is waiting, or whose last run failed
 * or went quiet, can be started, so a double-click or a second tab can't run
 * the pipeline twice over the same job.
 */
export async function startImportAction(jobId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const userId = await requireUserId();
  try {
    await connectDB();
    const staleBefore = Date.now() - RUN_STALE_AFTER_MS;
    const claimed = await ImportJob.findOneAndUpdate(
      {
        _id: jobId,
        ownerId: userId,
        projectType: { $exists: true },
        hasFrontCover: { $exists: true },
        $or: [
          { status: "intent-set" },
          { status: "processing", "run.phase": "failed" },
          // A run whose record never landed (or was lost) — see effectiveRun.
          { status: "processed", run: { $exists: false } },
          { status: "processing", run: { $exists: false }, updatedAt: { $lt: new Date(staleBefore) } },
          { status: "processing", "run.updatedAt": { $lt: staleBefore } },
        ],
      },
      { $set: { status: "processing", expiresAt: new Date(Date.now() + IMPORT_JOB_TTL_MS) }, $unset: { run: "", summary: "" } },
      { new: false }
    ).lean<Record<string, unknown>>();

    if (!claimed) {
      // Already running (or finished) — the screen will simply show where it is.
      const existing = await ImportJob.findOne({ _id: jobId, ownerId: userId }).select("status").lean<{ status?: string }>();
      if (!existing) return { ok: false, error: "This import has expired — upload the PDF again to start over." };
      return { ok: true };
    }

    // Retrying: clear what the failed run left behind so nothing stale is shown.
    const previous = (claimed.run ?? null) as RunState | null;
    void previous;
    after(() => runImportPipeline(jobId, userId));
  } catch (err) {
    console.error("startImportAction failed", err);
    return { ok: false, error: "Couldn’t start just now — try again." };
  }
  revalidatePath(`/projects/import/${jobId}`);
  return { ok: true };
}
