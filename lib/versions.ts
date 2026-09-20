import "server-only";
import { notFound } from "next/navigation";
import { connectDB } from "@/lib/db";
import { Chapter } from "@/lib/models/chapter";
import { ChapterVersion } from "@/lib/models/chapter-version";
import { requireUserId } from "@/lib/projects";

// Don't snapshot more than once per this window while someone is actively
// writing — autosave fires every ~900ms, but a version every 900ms would
// be noise, not history.
const AUTO_SNAPSHOT_MIN_INTERVAL_MS = 15 * 60 * 1000;

export type SerializedVersion = {
  id: string;
  title: string;
  wordCount: number;
  kind: "auto" | "manual" | "restore-point";
  label?: string;
  createdAt: string;
};

function serializeVersion(doc: Record<string, unknown>): SerializedVersion {
  return {
    id: String(doc._id),
    title: doc.title as string,
    wordCount: (doc.wordCount as number) ?? 0,
    kind: (doc.kind as SerializedVersion["kind"]) ?? "auto",
    label: (doc.label as string) || undefined,
    createdAt: new Date(doc.createdAt as string).toISOString(),
  };
}

export async function listVersionsForChapter(
  projectId: string,
  chapterId: string
): Promise<SerializedVersion[]> {
  const userId = await requireUserId();
  await connectDB();
  const docs = await ChapterVersion.find({ projectId, chapterId, ownerId: userId })
    .sort({ createdAt: -1 })
    .lean<Record<string, unknown>[]>();
  return docs.map(serializeVersion);
}

export async function requireVersionContent(
  projectId: string,
  chapterId: string,
  versionId: string
): Promise<{ title: string; content: unknown; wordCount: number }> {
  const userId = await requireUserId();
  await connectDB();
  let doc: Record<string, unknown> | null;
  try {
    doc = await ChapterVersion.findOne({
      _id: versionId,
      projectId,
      chapterId,
      ownerId: userId,
    }).lean<Record<string, unknown>>();
  } catch {
    notFound();
  }
  if (!doc) notFound();
  return {
    title: doc.title as string,
    content: doc.content ?? null,
    wordCount: (doc.wordCount as number) ?? 0,
  };
}

/**
 * Called after every content save. Takes an automatic snapshot at most
 * once per AUTO_SNAPSHOT_MIN_INTERVAL_MS, and only if the content or
 * title actually changed since the last snapshot — so idle re-saves of
 * unchanged content never pile up empty history entries.
 */
export async function maybeCreateAutoSnapshot(params: {
  userId: string;
  projectId: string;
  chapterId: string;
  title: string;
  content: unknown;
  wordCount: number;
}): Promise<void> {
  const { userId, projectId, chapterId, title, content, wordCount } = params;
  await connectDB();

  const last = await ChapterVersion.findOne({ chapterId, ownerId: userId })
    .sort({ createdAt: -1 })
    .lean<Record<string, unknown>>();

  if (last) {
    const age = Date.now() - new Date(last.createdAt as string).getTime();
    const unchanged =
      JSON.stringify(last.content) === JSON.stringify(content) && last.title === title;
    if (age < AUTO_SNAPSHOT_MIN_INTERVAL_MS || unchanged) return;
  }

  await ChapterVersion.create({
    chapterId,
    projectId,
    ownerId: userId,
    title,
    content,
    wordCount,
    kind: "auto",
  });
}

export async function createManualSnapshot(
  projectId: string,
  chapterId: string,
  label?: string
): Promise<{ ok: boolean }> {
  const userId = await requireUserId();
  await connectDB();

  const chapter = await Chapter.findOne({
    _id: chapterId,
    projectId,
    ownerId: userId,
  }).lean<Record<string, unknown>>();
  if (!chapter) return { ok: false };

  await ChapterVersion.create({
    chapterId,
    projectId,
    ownerId: userId,
    title: chapter.title,
    content: chapter.content,
    wordCount: chapter.wordCount ?? 0,
    kind: "manual",
    label: label?.trim() || undefined,
  });

  return { ok: true };
}

export async function restoreVersion(
  projectId: string,
  chapterId: string,
  versionId: string
): Promise<{ ok: boolean }> {
  const userId = await requireUserId();
  await connectDB();

  const [chapter, version] = await Promise.all([
    Chapter.findOne({ _id: chapterId, projectId, ownerId: userId }).lean<Record<string, unknown>>(),
    ChapterVersion.findOne({
      _id: versionId,
      chapterId,
      projectId,
      ownerId: userId,
    }).lean<Record<string, unknown>>(),
  ]);
  if (!chapter || !version) return { ok: false };

  // Snapshot the pre-restore state first, so restoring is itself
  // reversible rather than silently discarding the current draft.
  await ChapterVersion.create({
    chapterId,
    projectId,
    ownerId: userId,
    title: chapter.title,
    content: chapter.content,
    wordCount: chapter.wordCount ?? 0,
    kind: "restore-point",
    label: "Before restore",
  });

  await Chapter.updateOne(
    { _id: chapterId, projectId, ownerId: userId },
    { $set: { title: version.title, content: version.content, wordCount: version.wordCount ?? 0 } }
  );

  return { ok: true };
}
