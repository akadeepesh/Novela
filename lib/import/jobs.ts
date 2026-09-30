import "server-only";
import { cache } from "react";
import { connectDB } from "@/lib/db";
import { ImportJob } from "@/lib/models/import-job";
import { requireUserId } from "@/lib/projects";
import { normalizeProjectType, type ProjectType } from "@/lib/project-config";
import type { IntakeReport } from "@/lib/import/config";

export type SerializedImportJob = {
  id: string;
  status: "intake-passed" | "intent-set";
  fileName: string;
  fileSize: number;
  intake: IntakeReport;
  /** Unset until the person has answered — see the model comment. */
  projectType?: ProjectType;
  hasFrontCover?: boolean;
};

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
  };
});
