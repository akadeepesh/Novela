import { db, newId, nowIso, type ChapterRecord, type VersionRecord } from "./db"
import { hashContent } from "./hash"
import { isActiveProject } from "./projects"

// Don't snapshot more than once per this window while someone is actively
// writing: autosave fires about every second, and a version every second
// would be noise, not history.
const AUTO_SNAPSHOT_MIN_INTERVAL_MS = 15 * 60 * 1000

// "Big delete" guard: a save that removes more than 20% of a chapter of at
// least 100 words snapshots the text it is about to replace, regardless of
// the 15-minute interval (but not more than once a minute).
const BIG_DELETE_RATIO = 0.2
const BIG_DELETE_MIN_WORDS = 100
const BIG_DELETE_COOLDOWN_MS = 60 * 1000

/** Automatic snapshots kept per chapter, newest first. Manual versions are never pruned. */
export const AUTO_VERSIONS_KEPT = 200

const MAX_LABEL_LENGTH = 120

export type SerializedVersion = {
  id: string
  title: string
  wordCount: number
  kind: VersionRecord["kind"]
  label?: string
  createdAt: string
}

function serializeVersion(v: VersionRecord): SerializedVersion {
  return {
    id: v.id,
    title: v.title,
    wordCount: v.wordCount ?? 0,
    kind: v.kind ?? "auto",
    label: v.label || undefined,
    createdAt: v.createdAt,
  }
}

async function versionsNewestFirst(chapterId: string): Promise<VersionRecord[]> {
  return db()
    .versions.where("[chapterId+createdAt]")
    .between([chapterId, ""], [chapterId, "￿"])
    .reverse()
    .toArray()
}

export async function listVersionsForChapter(projectId: string, chapterId: string): Promise<SerializedVersion[]> {
  const all = await versionsNewestFirst(chapterId)
  return all.filter((v) => v.projectId === projectId).map(serializeVersion)
}

export async function findVersionContent(
  projectId: string,
  chapterId: string,
  versionId: string
): Promise<{ title: string; content: unknown; wordCount: number } | null> {
  const v = await db().versions.get(versionId)
  if (!v || v.projectId !== projectId || v.chapterId !== chapterId) return null
  return { title: v.title, content: v.content ?? null, wordCount: v.wordCount ?? 0 }
}

/** Keeps only the newest AUTO_VERSIONS_KEPT auto versions. Manual versions and restore points stay. */
async function pruneAutoVersions(chapterId: string): Promise<void> {
  const autos = (await versionsNewestFirst(chapterId)).filter((v) => v.kind === "auto")
  const extra = autos.slice(AUTO_VERSIONS_KEPT).map((v) => v.id)
  if (extra.length > 0) await db().versions.bulkDelete(extra)
}

/**
 * Called after a content save, with the chapter as it was BEFORE that save.
 *
 * The version history exists so people can get back text they lost, so it
 * keeps the state before a change, not the state just written. A snapshot
 * is taken when the last one is older than the interval, or when this save
 * removes a big chunk of text, and only if that text isn't already the
 * newest version.
 */
export async function snapshotBeforeSave(params: {
  previous: ChapterRecord
  newHash: string
  newWordCount?: number
}): Promise<void> {
  const { previous, newHash, newWordCount } = params
  if (previous.content == null) return

  const prevHash = previous.contentHash ?? (await hashContent(previous.content))
  if (prevHash === newHash) return

  const now = Date.now()
  const sinceLast = previous.lastSnapshotAt ? now - new Date(previous.lastSnapshotAt).getTime() : Infinity
  const prevWords = previous.wordCount ?? 0
  const dueByTime = sinceLast >= AUTO_SNAPSHOT_MIN_INTERVAL_MS
  const bigDelete =
    newWordCount !== undefined &&
    prevWords >= BIG_DELETE_MIN_WORDS &&
    newWordCount < prevWords * (1 - BIG_DELETE_RATIO) &&
    sinceLast >= BIG_DELETE_COOLDOWN_MS
  if (!dueByTime && !bigDelete) return

  const newest = (await versionsNewestFirst(previous.id))[0]
  if (newest?.contentHash !== prevHash) {
    await db().versions.add({
      id: newId(),
      chapterId: previous.id,
      projectId: previous.projectId,
      title: previous.title,
      content: previous.content,
      wordCount: prevWords,
      contentHash: prevHash,
      kind: "auto",
      createdAt: nowIso(),
    })
    await pruneAutoVersions(previous.id)
  }
  // Bookkeeping only: updatedAt stays, so it doesn't count as "worked on".
  await db().chapters.update(previous.id, { lastSnapshotAt: new Date(now).toISOString() })
}

export async function createManualSnapshot(
  projectId: string,
  chapterId: string,
  label?: string
): Promise<{ ok: boolean; error?: string }> {
  if (!(await isActiveProject(projectId))) return { ok: false }
  const chapter = await db().chapters.get(chapterId)
  if (!chapter || chapter.projectId !== projectId || chapter.deletedAt) return { ok: false }
  await db().versions.add({
    id: newId(),
    chapterId,
    projectId,
    title: chapter.title,
    content: chapter.content,
    wordCount: chapter.wordCount ?? 0,
    contentHash: chapter.contentHash ?? (await hashContent(chapter.content)),
    kind: "manual",
    label: label?.trim().slice(0, MAX_LABEL_LENGTH) || undefined,
    createdAt: nowIso(),
  })
  return { ok: true }
}

/** Restores a version, first saving the current text as a "Before restore" point. */
export async function restoreVersion(projectId: string, chapterId: string, versionId: string): Promise<{ ok: boolean }> {
  if (!(await isActiveProject(projectId))) return { ok: false }
  const d = db()
  const [chapter, version] = await Promise.all([d.chapters.get(chapterId), d.versions.get(versionId)])
  if (!chapter || chapter.projectId !== projectId || chapter.deletedAt) return { ok: false }
  if (!version || version.chapterId !== chapterId) return { ok: false }

  const [currentHash, restoredHash] = await Promise.all([
    chapter.contentHash ?? hashContent(chapter.content),
    version.contentHash ?? hashContent(version.content),
  ])
  const now = nowIso()
  await d.transaction("rw", [d.chapters, d.versions], async () => {
    await d.versions.add({
      id: newId(),
      chapterId,
      projectId,
      title: chapter.title,
      content: chapter.content,
      wordCount: chapter.wordCount ?? 0,
      contentHash: currentHash,
      kind: "restore-point",
      label: "Before restore",
      createdAt: now,
    })
    const fresh = await d.chapters.get(chapterId)
    if (!fresh) return
    await d.chapters.put({
      ...fresh,
      // Bump the version so another open tab sees a conflict, not a silent overwrite.
      version: (fresh.version ?? 0) + 1,
      title: version.title,
      content: version.content,
      wordCount: version.wordCount ?? 0,
      contentHash: restoredHash,
      updatedAt: now,
    })
  })
  return { ok: true }
}
