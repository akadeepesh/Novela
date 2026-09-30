"use server";

import { connectDB } from "@/lib/db";
import { ImportJob } from "@/lib/models/import-job";
import { requireUserId } from "@/lib/projects";
import { IMPORT_MAX_BYTES, rejection, type IntakeRejection, type IntakeReport } from "@/lib/import/config";
import { inspectPdf } from "@/lib/import/inspect-pdf";
import { deleteImportBlob, isOwnedImportUrl } from "@/lib/import/storage";

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
  url: string;
  fileName: string;
}): Promise<IntakeActionResult> {
  const userId = await requireUserId();

  if (typeof input?.url !== "string" || !isOwnedImportUrl(input.url, userId)) {
    return { ok: false, ...rejection("upload-invalid") };
  }

  try {
    const res = await fetch(input.url, { cache: "no-store", signal: AbortSignal.timeout(30_000) });
    if (!res.ok) {
      await deleteImportBlob(input.url);
      return { ok: false, ...rejection("upload-invalid") };
    }

    // Don't trust the client's idea of the size — check what actually arrived.
    const declared = Number(res.headers.get("content-length") ?? 0);
    if (declared > IMPORT_MAX_BYTES) {
      await deleteImportBlob(input.url);
      return { ok: false, ...rejection("too-large") };
    }
    const bytes = new Uint8Array(await res.arrayBuffer());
    const fileSize = bytes.length;

    const result = await inspectPdf(bytes);
    if (!result.ok) {
      await deleteImportBlob(input.url);
      const { ok: _ok, ...rest } = result;
      void _ok;
      return { ok: false, ...rest };
    }

    await connectDB();
    const job = await ImportJob.create({
      ownerId: userId,
      sourceUrl: input.url,
      fileName: String(input.fileName ?? "").slice(0, 255),
      fileSize,
      intake: result.report,
    });

    return { ok: true, jobId: String(job._id), report: result.report };
  } catch (err) {
    console.error("runIntakeAction failed", err);
    await deleteImportBlob(input.url);
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
    await deleteImportBlob(job.sourceUrl as string);
    return { ok: true };
  } catch {
    // Malformed id or a transient DB error — the job's TTL will reap the record regardless.
    return { ok: false };
  }
}
