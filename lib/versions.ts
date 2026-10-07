import "server-only";
import { createHash } from "node:crypto";
import { notFound } from "next/navigation";
import { connectDB } from "@/lib/db";
import { Chapter } from "@/lib/models/chapter";
import { ChapterVersion } from "@/lib/models/chapter-version";
import { requireUserId } from "@/lib/projects";

// Don't snapshot more than once per this window while someone is actively
// writing — autosave fires every ~900ms, but a version every 900ms would
// be noise, not history.
const AUTO_SNAPSHOT_MIN_INTERVAL_MS = 15 * 60 * 1000;

// "Big delete" guard: a save that removes more than 20% of a chapter of at
// least 100 words snapshots the text it is about to replace, regardless of the
// 15-minute interval (but not more than once a minute).
const BIG_DELETE_RATIO = 0.2;
const BIG_DELETE_MIN_WORDS = 100;
const BIG_DELETE_COOLDOWN_MS = 60 * 1000;

// Retention for automatic versions: count only, never age. Manual versions and restore points are kept.
const MAX_AUTO_VERSIONS_PER_CHAPTER = 50;

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

export function hashContent(content: unknown): string {
  return createHash("sha256").update(JSON.stringify(content ?? null)).digest("hex");
}

/** Keeps only the newest MAX_AUTO_VERSIONS_PER_CHAPTER auto versions. Manual versions and restore points are never touched. Age is deliberately not a factor: a writer may return after months. */
async function pruneAutoVersions(userId: string, chapterId: string): Promise<void> {
  const extra = await ChapterVersion.find({ chapterId, ownerId: userId, kind: "auto" })
    .sort({ createdAt: -1 })
    .skip(MAX_AUTO_VERSIONS_PER_CHAPTER)
    .select("_id")
    .lean<{ _id: unknown }[]>();
  if (extra.length > 0) {
    await ChapterVersion.deleteMany({ _id: { $in: extra.map((v) => v._id) } });
  }
}

/**
 * Called after a content save, with the chapter as it was BEFORE that save.
 *
 * The version history exists so people can get back text they lost, so what
 * we keep is the state *before* the change, not the state just written. A
 * snapshot is taken when:
 *   - the last one is older than AUTO_SNAPSHOT_MIN_INTERVAL_MS, or
 *   - this save removes a big chunk of the text (BIG_DELETE_RATIO), even if a
 *     snapshot was taken a minute ago.
 * and only if the previous text isn't already the newest version.
 */
export async function snapshotBeforeSave(params: {
  userId: string;
  projectId: string;
  chapterId: string;
  previous: {
    title: string;
    content: unknown;
    wordCount?: number;
    contentHash?: string;
    lastSnapshotAt?: Date;
  };
  newHash: string;
  newWordCount?: number;
}): Promise<void> {
  const { userId, projectId, chapterId, previous, newHash, newWordCount } = params;

  // Nothing worth protecting yet (a brand-new empty chapter).
  if (previous.content == null) return;

  const prevHash = previous.contentHash ?? hashContent(previous.content);
  if (prevHash === newHash) return;

  const now = Date.now();
  const sinceLast = previous.lastSnapshotAt ? now - new Date(previous.lastSnapshotAt).getTime() : Infinity;
  const prevWords = previous.wordCount ?? 0;

  const dueByTime = sinceLast >= AUTO_SNAPSHOT_MIN_INTERVAL_MS;
  const bigDelete =
    newWordCount !== undefined &&
    prevWords >= BIG_DELETE_MIN_WORDS &&
    newWordCount < prevWords * (1 - BIG_DELETE_RATIO) &&
    sinceLast >= BIG_DELETE_COOLDOWN_MS;
  if (!dueByTime && !bigDelete) return;

  await connectDB();

  // Already have exactly this text as the newest version? Don't duplicate it.
  const newest = await ChapterVersion.findOne({ chapterId, ownerId: userId })
    .sort({ createdAt: -1 })
    .select("contentHash")
    .lean<{ contentHash?: string }>();
  if (newest?.contentHash !== prevHash) {
    await ChapterVersion.create({
      chapterId,
      projectId,
      ownerId: userId,
      title: previous.title,
      content: previous.content,
      wordCount: prevWords,
      contentHash: prevHash,
      kind: "auto",
    });
    await pruneAutoVersions(userId, chapterId);
  }

  // timestamps:false — bookkeeping shouldn't move the chapter to the top of "Last worked on".
  await Chapter.updateOne(
    { _id: chapterId, ownerId: userId },
    { $set: { lastSnapshotAt: new Date(now) } },
    { timestamps: false }
  );
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
    contentHash: hashContent(chapter.content),
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
    contentHash: hashContent(chapter.content),
    kind: "restore-point",
    label: "Before restore",
  });

  await Chapter.updateOne(
    { _id: chapterId, projectId, ownerId: userId },
    {
      // Bump the version so another open tab sees a conflict, not a silent overwrite.
      $inc: { version: 1 },
      $set: {
        title: version.title,
        content: version.content,
        wordCount: version.wordCount ?? 0,
        contentHash: hashContent(version.content),
      },
    }
  );

  return { ok: true };
}
