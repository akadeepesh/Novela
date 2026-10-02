import "server-only";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db";
import { ImportJob } from "@/lib/models/import-job";
import { readImportBlob } from "@/lib/import/storage";

export type PreviewJob = {
  fileName: string;
  projectType?: string;
  hasFrontCover?: boolean;
  /** Fresh bytes — pdf.js takes ownership of the buffer, so each request reads its own. */
  bytes: Uint8Array;
};

/**
 * Shared front door for the development-only preview routes. Returns either
 * the loaded job or the response to send instead.
 *
 * Hard-stops outside `next dev`: nothing built on this should ever be
 * reachable in a deployed build. Scopes the lookup to the signed-in owner.
 */
export async function loadPreviewJob(
  jobId: string
): Promise<{ ok: true; job: PreviewJob } | { ok: false; response: NextResponse }> {
  const fail = (body: string, status: number) => ({
    ok: false as const,
    response: new NextResponse(body, { status }),
  });

  if (process.env.NODE_ENV === "production") return fail("Not found", 404);

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return fail("Unauthorized", 401);

  let doc: Record<string, unknown> | null;
  try {
    await connectDB();
    doc = await ImportJob.findOne({ _id: jobId, ownerId: userId }).lean<Record<string, unknown>>();
  } catch {
    doc = null; // malformed id
  }
  if (!doc) return fail("No such import (it may have expired).", 404);

  const read = await readImportBlob(doc.sourcePathname as string);
  if (!read.ok) return fail("The uploaded PDF is no longer available.", 404);

  return {
    ok: true,
    job: {
      fileName: (doc.fileName as string) ?? "",
      projectType: doc.projectType as string | undefined,
      hasFrontCover: typeof doc.hasFrontCover === "boolean" ? doc.hasFrontCover : undefined,
      bytes: read.bytes,
    },
  };
}
