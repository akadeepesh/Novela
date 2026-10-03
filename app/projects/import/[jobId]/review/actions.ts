"use server";

import { connectDB } from "@/lib/db";
import { ImportJob } from "@/lib/models/import-job";
import { requireUserId } from "@/lib/projects";
import { IMPORT_JOB_TTL_MS } from "@/lib/import/config";
import { sanitizeReviewState } from "@/lib/import/review/sanitize";

const MAX_SAVE_BYTES = 4 * 1024 * 1024;

/**
 * Saves the person's working copy as they go, so a closed tab or a crash
 * loses nothing. The state comes from the browser: it's rebuilt from a
 * whitelist (sanitizeReviewState) rather than stored as sent, and each save
 * pushes the job's expiry out so a book under review doesn't lapse mid-edit.
 */
export async function saveReviewAction(jobId: string, raw: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const userId = await requireUserId();
  const state = sanitizeReviewState(raw);
  if (!state) return { ok: false, error: "That version of the review couldn’t be saved." };
  if (JSON.stringify(state).length > MAX_SAVE_BYTES) return { ok: false, error: "This review has grown too large to save." };
  try {
    await connectDB();
    const res = await ImportJob.updateOne(
      { _id: jobId, ownerId: userId, status: "processed" },
      { $set: { review: state, expiresAt: new Date(Date.now() + IMPORT_JOB_TTL_MS) } }
    );
    if (res.matchedCount === 0) return { ok: false, error: "This import has expired — upload the PDF again to start over." };
    return { ok: true };
  } catch (err) {
    console.error("saveReviewAction failed", err);
    return { ok: false, error: "Couldn’t save just now." };
  }
}
