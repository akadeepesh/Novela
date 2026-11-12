import { db, newId, nowIso, type CommentRecord } from "./db"
import { isActiveProject } from "./projects"

/** The writer's margin notes, anchored in the chapter text by a `comment` mark carrying the id. */

export type SerializedComment = {
  id: string
  chapterId: string
  body: string
  quote: string
  resolved: boolean
  createdAt: string
}

/** Longest passage stored with a comment. */
export const MAX_QUOTE_LENGTH = 500
const MAX_BODY_LENGTH = 2000
const MAX_COMMENTS_PER_CHAPTER = 500

function serialize(c: CommentRecord): SerializedComment {
  return {
    id: c.id,
    chapterId: c.chapterId,
    body: c.body,
    quote: c.quote ?? "",
    resolved: Boolean(c.resolved),
    createdAt: c.createdAt,
  }
}

/** Every comment on a chapter, oldest first. */
export async function listChapterComments(projectId: string, chapterId: string): Promise<SerializedComment[]> {
  const all = await db().comments.where("chapterId").equals(chapterId).toArray()
  return all
    .filter((c) => c.projectId === projectId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map(serialize)
}

export async function createComment(
  projectId: string,
  chapterId: string,
  input: { body: string; quote: string }
): Promise<{ ok: true; comment: SerializedComment } | { ok: false; error: string }> {
  const body = input.body.trim()
  if (!body || body.length > MAX_BODY_LENGTH) return { ok: false, error: "Write something first (up to 2,000 characters)." }
  if (!(await isActiveProject(projectId))) return { ok: false, error: "Couldn't find this project." }
  const chapter = await db().chapters.get(chapterId)
  if (!chapter || chapter.projectId !== projectId || chapter.deletedAt) {
    return { ok: false, error: "Couldn't find this chapter." }
  }
  if ((await db().comments.where("chapterId").equals(chapterId).count()) >= MAX_COMMENTS_PER_CHAPTER) {
    return { ok: false, error: "This chapter has too many comments. Delete some you've dealt with first." }
  }
  const now = nowIso()
  const record: CommentRecord = {
    id: newId(),
    projectId,
    chapterId,
    body,
    quote: input.quote.trim().slice(0, MAX_QUOTE_LENGTH),
    resolved: false,
    createdAt: now,
    updatedAt: now,
  }
  await db().comments.add(record)
  return { ok: true, comment: serialize(record) }
}

export async function setCommentResolved(projectId: string, commentId: string, resolved: boolean): Promise<boolean> {
  if (!(await isActiveProject(projectId))) return false
  const c = await db().comments.get(commentId)
  if (!c || c.projectId !== projectId) return false
  await db().comments.update(commentId, { resolved, updatedAt: nowIso() })
  return true
}

export async function deleteComment(projectId: string, commentId: string): Promise<boolean> {
  if (!(await isActiveProject(projectId))) return false
  const c = await db().comments.get(commentId)
  if (!c || c.projectId !== projectId) return false
  await db().comments.delete(commentId)
  return true
}
