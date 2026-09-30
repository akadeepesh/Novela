"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import { ImportJob } from "@/lib/models/import-job";
import { requireUserId } from "@/lib/projects";
import { PROJECT_TYPES } from "@/lib/project-config";
import { IMPORT_JOB_TTL_MS, rejection, type IntakeRejection, type IntakeReport } from "@/lib/import/config";
import { inspectPdf } from "@/lib/import/inspect-pdf";
import { deleteImportBlob, isOwnedImportPathname, readImportBlob } from "@/lib/import/storage";

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
