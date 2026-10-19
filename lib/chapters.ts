import "server-only";
import { isObjectId } from "@/lib/object-id";
import { cache } from "react";
import { notFound } from "next/navigation";
import { connectDB } from "@/lib/db";
import { Chapter, CHAPTER_ORDER } from "@/lib/models/chapter";
import { requireUserId } from "@/lib/projects";
import { TRASH_DAYS } from "@/lib/trash-config";
import type { ChapterLabel } from "@/lib/chapter-config";

export type SerializedChapterSummary = {
  id: string;
  title: string;
  order: number;
  wordCount: number;
  status: "draft" | "in-progress" | "done";
  synopsis: string;
  label: ChapterLabel;
  updatedAt: string;
};

export type SerializedChapter = SerializedChapterSummary & {
  projectId: string;
  content: unknown;
  version: number;
};

function serializeSummary(doc: Record<string, unknown>): SerializedChapterSummary {
  return {
    id: String(doc._id),
    title: doc.title as string,
    order: doc.order as number,
    wordCount: (doc.wordCount as number) ?? 0,
    status: (doc.status as SerializedChapterSummary["status"]) ?? "draft",
    synopsis: (doc.synopsis as string) ?? "",
    label: (doc.label as ChapterLabel) ?? "",
    updatedAt: new Date(doc.updatedAt as string).toISOString(),
  };
}

export async function listChaptersForProject(
  projectId: string
): Promise<SerializedChapterSummary[]> {
  const userId = await requireUserId();
  await connectDB();
  const docs = await Chapter.find({ projectId, ownerId: userId, deletedAt: null })
    .sort(CHAPTER_ORDER)
    .lean<Record<string, unknown>[]>();
  return docs.map(serializeSummary);
}

export type TrashedChapter = { id: string; title: string; wordCount: number; daysLeft: number };

/** This project's chapters in the Trash, most recently trashed first. */
export async function listTrashedChapters(projectId: string): Promise<TrashedChapter[]> {
  const userId = await requireUserId();
  await connectDB();
  const docs = await Chapter.find({ projectId, ownerId: userId, deletedAt: { $ne: null } })
    .select("title wordCount deletedAt")
    .sort({ deletedAt: -1 })
    .lean<{ _id: unknown; title: string; wordCount?: number; deletedAt: Date }[]>();
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  return docs.map((d) => ({
    id: String(d._id),
    title: d.title,
    wordCount: d.wordCount ?? 0,
    daysLeft: Math.max(0, Math.ceil((new Date(d.deletedAt).getTime() + TRASH_DAYS * dayMs - now) / dayMs)),
  }));
}

export const requireChapter = cache(async (
  projectId: string,
  chapterId: string
): Promise<SerializedChapter> => {
  const userId = await requireUserId();
  await connectDB();

  // A malformed id is "not found"; a real database error is left to propagate
  // (reported as an error) instead of being hidden as a 404.
  if (!isObjectId(projectId) || !isObjectId(chapterId)) notFound();
  const doc = await Chapter.findOne({
      _id: chapterId,
      projectId,
      ownerId: userId,
      deletedAt: null,
    }).lean<Record<string, unknown>>();
  if (!doc) notFound();

  return {
    ...serializeSummary(doc),
    projectId,
    content: doc.content ?? null,
    version: (doc.version as number) ?? 0,
  };
});
