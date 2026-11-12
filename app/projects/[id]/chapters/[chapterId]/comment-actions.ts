import {
  createComment,
  deleteComment,
  listChapterComments,
  setCommentResolved,
  type SerializedComment,
} from "@/lib/store/comments"

/** Every margin note on a chapter, oldest first. */
export async function listChapterCommentsAction(
  projectId: string,
  chapterId: string
): Promise<{ ok: true; comments: SerializedComment[] } | { ok: false }> {
  return { ok: true, comments: await listChapterComments(projectId, chapterId) }
}

/** The writer's own margin note. The editor then marks the passage with the returned id. */
export async function createOwnerCommentAction(
  projectId: string,
  chapterId: string,
  input: { body: string; quote: string }
): Promise<{ ok: true; comment: SerializedComment } | { ok: false; error: string }> {
  return createComment(projectId, chapterId, input)
}

export async function setCommentResolvedAction(
  projectId: string,
  commentId: string,
  resolved: boolean
): Promise<{ ok: boolean }> {
  return { ok: await setCommentResolved(projectId, commentId, Boolean(resolved)) }
}

export async function deleteCommentAction(projectId: string, commentId: string): Promise<{ ok: boolean }> {
  return { ok: await deleteComment(projectId, commentId) }
}
