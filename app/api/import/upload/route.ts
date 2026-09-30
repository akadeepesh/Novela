import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { auth } from "@/auth";
import { IMPORT_MAX_BYTES, importBlobPrefix } from "@/lib/import/config";

/**
 * Issues short-lived tokens so the browser can upload a PDF straight to
 * Blob. The file never passes through a serverless function, whose request
 * body limit (a few MB) is smaller than a real book interior can be.
 *
 * There is deliberately no `onUploadCompleted`. With it, Vercel calls this
 * app back when an upload finishes — which can't work on localhost — and
 * this flow has no use for it: intake runs from the client's follow-up
 * action. Without it, the token carries no callback at all.
 *
 * Auth lives inside onBeforeGenerateToken so the session is checked exactly
 * when a token is about to be minted.
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
        if (!pathname.startsWith(importBlobPrefix(userId)) || pathname.includes("..")) {
          throw new Error("Invalid upload path");
        }
        return {
          allowedContentTypes: ["application/pdf"],
          maximumSizeInBytes: IMPORT_MAX_BYTES,
          // The random suffix keeps pathnames unguessable on top of the
          // blob being private.
          addRandomSuffix: true,
        };
      },
    });
    return NextResponse.json(json);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    console.error("import upload token failed:", message);
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
