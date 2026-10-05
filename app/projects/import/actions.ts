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
import { openImportFile } from "@/lib/import/pipeline/store";
import { sanitizeReviewState } from "@/lib/import/review/sanitize";
import { Project } from "@/lib/models/project";
import { Chapter } from "@/lib/models/chapter";
import { deleteProjectImage, uploadProjectImage } from "@/lib/blob";
import { getDefaultSections, normalizeProjectType } from "@/lib/project-config";
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
    for (const key of ["textPathname", "resultPathname", "backgroundPathname", "backgroundEditedPathname", "coverPathname"]) {
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

async function scratchImage(pathname: string | undefined, mime: string, name: string): Promise<File | null> {
  if (!pathname) return null;
  const file = await openImportFile(pathname);
  if (!file) return null;
  const bytes = new Uint8Array(await new Response(file.stream).arrayBuffer());
  return new File([bytes], name, { type: mime });
}

/**
 * Step 11: turns the reviewed import into a real book. Builds the project and
 * one chapter per piece, moves the chosen background and cover from scratch
 * storage into the project's own, then clears the scratch work away.
 *
 * Safe to retry: the job is claimed first (so a double-click can't make two
 * books), and if anything fails after the project exists, the half-built
 * project is removed and the job goes back to "processed" with its review
 * intact.
 */
export async function commitImportAction(jobId: string): Promise<{ ok: true; next: string } | { ok: false; error: string }> {
  const userId = await requireUserId();
  await connectDB();

  const claimed = await ImportJob.findOneAndUpdate(
    { _id: jobId, ownerId: userId, status: "processed" },
    { $set: { status: "committing" } },
    { new: false }
  ).lean<Record<string, unknown>>();
  if (!claimed) return { ok: false, error: "This import is already being created, or has expired." };

  const release = () => ImportJob.updateOne({ _id: jobId, ownerId: userId, status: "committing" }, { $set: { status: "processed" } }).catch(() => {});
  const state = sanitizeReviewState(claimed.review);
  if (!state) {
    await release();
    return { ok: false, error: "Your review wasn’t saved yet — try again in a moment." };
  }

  const type = normalizeProjectType((claimed.projectType as string) ?? "custom");
  const assets = (claimed.assets ?? {}) as Record<string, string | undefined>;
  let projectId: string | null = null;
  const uploaded: string[] = [];

  try {
    const project = await Project.create({
      ownerId: userId,
      title: state.bookTitle,
      type,
      sections: getDefaultSections(type),
    });
    projectId = String(project._id);

    const inserted = await Chapter.insertMany(
      state.pieces.map((p, order) => ({
        projectId: project._id,
        ownerId: userId,
        title: p.title,
        order,
        content: p.doc,
        wordCount: p.wordCount,
        status: "draft",
      }))
    );

    const update: Record<string, unknown> = {};

    if (state.background.kind === "preset") {
      update["manuscriptSettings.background"] = state.background.id;
    } else {
      const edited = assets.backgroundEditedPathname;
      const file = edited
        ? await scratchImage(edited, "image/png", "background.png")
        : await scratchImage(assets.backgroundPathname, assets.backgroundMime ?? "image/png", "background");
      if (!file) throw new Error("commit: the lifted background could not be read back from scratch storage");
      const result = await uploadProjectImage({ projectId, kind: "background", file });
      // Not a quiet fallback: a book that silently loses its design is worse than one that says so and can be retried.
      if (!result.ok) throw new Error(`commit: background upload failed — ${result.error}`);
      uploaded.push(result.url);
      update["manuscriptSettings.background"] = "custom";
      update["manuscriptSettings.backgroundImageUrl"] = result.url;
      // The lifted design is already clean — the usual cream veil would wash it out.
      update["manuscriptSettings.backgroundVeil"] = false;
    }

    if (state.useCover && assets.coverPathname) {
      const file = await scratchImage(assets.coverPathname, assets.coverMime ?? "image/jpeg", "cover");
      if (!file) throw new Error("commit: the cover could not be read back from scratch storage");
      const result = await uploadProjectImage({ projectId, kind: "cover-front", file });
      if (!result.ok) throw new Error(`commit: cover upload failed — ${result.error}`);
      uploaded.push(result.url);
      update.coverFrontUrl = result.url;
    }

    if (Object.keys(update).length) await Project.updateOne({ _id: project._id }, { $set: update });

    // Done — clear the scratch work and the job itself.
    await ImportJob.deleteOne({ _id: jobId, ownerId: userId });
    for (const key of ["sourcePathname"]) await deleteImportBlob(claimed[key] as string | undefined);
    for (const key of ["textPathname", "resultPathname", "backgroundPathname", "backgroundEditedPathname", "coverPathname"]) {
      await deleteImportBlob(assets[key]);
    }

    const first = inserted[0];
    void first;
    revalidatePath("/dashboard");
    return { ok: true, next: `/projects/${projectId}/overview` };
  } catch (err) {
    console.error("commitImportAction failed", err);
    if (projectId) {
      await Chapter.deleteMany({ projectId }).catch(() => {});
      await Project.deleteOne({ _id: projectId }).catch(() => {});
      for (const url of uploaded) await deleteProjectImage(url);
    }
    await release();
    const reason = process.env.NODE_ENV === "production" ? "" : ` (dev: ${err instanceof Error ? err.message : String(err)})`.slice(0, 240);
    return { ok: false, error: `Couldn’t create the book just now. Your review is saved — try again.${reason}` };
  }
}
