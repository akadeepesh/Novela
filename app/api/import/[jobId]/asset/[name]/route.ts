import { auth } from "@/auth";
import { connectDB } from "@/lib/db";
import { ImportJob } from "@/lib/models/import-job";
import { deleteImportBlob } from "@/lib/import/storage";
import { importFilePath, openImportFile, putImportFile } from "@/lib/import/pipeline/store";

type Ctx = { params: Promise<{ jobId: string; name: string }> };
const MAX_TOUCH_UP_BYTES = 6 * 1024 * 1024;
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47];

async function owner(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

async function findAssets(jobId: string, userId: string): Promise<Record<string, string | undefined> | null> {
  try {
    await connectDB();
    const doc = await ImportJob.findOne({ _id: jobId, ownerId: userId }).select("assets").lean<{ assets?: Record<string, string | undefined> }>();
    return doc?.assets ?? null;
  } catch {
    return null;
  }
}

/**
 * Serves one of an import's scratch pictures (the lifted background, the
 * cover) to its owner. The blobs are private, so the browser can only ever
 * see them through here. The background comes back with the person's
 * touch-ups unless `?original=1` asks for the untouched version.
 */
export async function GET(request: Request, { params }: Ctx) {
  const { jobId, name } = await params;
  if (name !== "background" && name !== "cover") return new Response("Not found", { status: 404 });
  const userId = await owner();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const assets = await findAssets(jobId, userId);
  const wantOriginal = new URL(request.url).searchParams.get("original") === "1";
  const edited = name === "background" && !wantOriginal ? assets?.backgroundEditedPathname : undefined;
  const pathname = edited ?? assets?.[`${name}Pathname`];
  const mime = edited ? "image/png" : (assets?.[`${name}Mime`] ?? "image/png");
  if (!pathname) return new Response("Not found", { status: 404 });

  const file = await openImportFile(pathname);
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(file.stream, { headers: { "Content-Type": mime, "Cache-Control": "private, no-cache" } });
}

/** Saves the touched-up background (a PNG) beside the original, which is kept so the person can reset. */
export async function POST(request: Request, { params }: Ctx) {
  const { jobId, name } = await params;
  if (name !== "background") return new Response("Not found", { status: 404 });
  const userId = await owner();
  if (!userId) return new Response("Unauthorized", { status: 401 });
  if (!(await findAssets(jobId, userId))?.backgroundPathname) return new Response("Not found", { status: 404 });

  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.length === 0 || bytes.length > MAX_TOUCH_UP_BYTES) return new Response("That picture is too large.", { status: 413 });
  if (!PNG_SIGNATURE.every((b, i) => bytes[i] === b)) return new Response("Expected a PNG.", { status: 415 });

  const pathname = importFilePath(userId, jobId, "background-edited.png");
  await putImportFile(pathname, bytes, "image/png");
  await ImportJob.updateOne({ _id: jobId, ownerId: userId }, { $set: { "assets.backgroundEditedPathname": pathname } });
  return Response.json({ ok: true });
}

/** Throws away the touch-ups: the original picture is served again. */
export async function DELETE(_request: Request, { params }: Ctx) {
  const { jobId, name } = await params;
  if (name !== "background") return new Response("Not found", { status: 404 });
  const userId = await owner();
  if (!userId) return new Response("Unauthorized", { status: 401 });
  const assets = await findAssets(jobId, userId);
  if (assets?.backgroundEditedPathname) {
    await deleteImportBlob(assets.backgroundEditedPathname);
    await ImportJob.updateOne({ _id: jobId, ownerId: userId }, { $unset: { "assets.backgroundEditedPathname": "" } });
  }
  return Response.json({ ok: true });
}
