import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { auth } from "@/auth";
import { IMPORT_MAX_BYTES, importBlobPrefix } from "@/lib/import/config";

/**
 * Issues short-lived tokens so the browser can upload a PDF straight to
 * Blob. The file never passes through a serverless function, whose request
 * body limit (a few MB) is smaller than a real book interior can be.
 *
 * Auth lives inside onBeforeGenerateToken rather than at the top of the
 * handler on purpose: this same route also receives Blob's server-to-server
 * "upload completed" callback, which carries no session cookie.
 */
export async function POST(request: Request) {
  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const session = await auth();
        const userId = session?.user?.id;
        if (!userId) throw new Error("Unauthorized");
        // Scratch uploads only ever land under this user's own prefix.
        if (!pathname.startsWith(importBlobPrefix(userId))) {
          throw new Error("Invalid upload path");
        }
        return {
          allowedContentTypes: ["application/pdf"],
          maximumSizeInBytes: IMPORT_MAX_BYTES,
          // Random suffix: the URL is the only thing gating read access to
          // someone's unpublished manuscript, so it must not be guessable.
          addRandomSuffix: true,
        };
      },
      // Intake runs from the client's follow-up action (which also works on
      // localhost, where Blob's callback can't reach), so nothing to do here.
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(json);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
