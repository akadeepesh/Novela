import { auth } from "@/auth";
import { connectDB } from "@/lib/db";
import { ImportJob } from "@/lib/models/import-job";
import { openImportFile } from "@/lib/import/pipeline/store";

/**
 * Serves one of an import's scratch pictures (the lifted background, the
 * cover) to its owner. The blobs are private, so the browser can only ever
 * see them through here.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ jobId: string; name: string }> }) {
  const { jobId, name } = await params;
  if (name !== "background" && name !== "cover") return new Response("Not found", { status: 404 });

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return new Response("Unauthorized", { status: 401 });

  let doc: { assets?: Record<string, string | undefined> } | null;
  try {
    await connectDB();
    doc = await ImportJob.findOne({ _id: jobId, ownerId: userId }).select("assets").lean();
  } catch {
    doc = null;
  }
  const pathname = doc?.assets?.[`${name}Pathname`];
  const mime = doc?.assets?.[`${name}Mime`] ?? "image/png";
  if (!pathname) return new Response("Not found", { status: 404 });

  const file = await openImportFile(pathname);
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(file.stream, {
    headers: { "Content-Type": mime, "Cache-Control": "private, max-age=300" },
  });
}
