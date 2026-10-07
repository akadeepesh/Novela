import "server-only";
import { isObjectId } from "@/lib/object-id";
import { cache } from "react";
import { notFound } from "next/navigation";
import { connectDB } from "@/lib/db";
import { Chapter } from "@/lib/models/chapter";
import { requireUserId } from "@/lib/projects";

export type SerializedChapterSummary = {
  id: string;
  title: string;
  order: number;
  wordCount: number;
  status: "draft" | "in-progress" | "done";
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
    updatedAt: new Date(doc.updatedAt as string).toISOString(),
  };
}

export async function listChaptersForProject(
  projectId: string
): Promise<SerializedChapterSummary[]> {
  const userId = await requireUserId();
  await connectDB();
  const docs = await Chapter.find({ projectId, ownerId: userId })
    .sort({ order: 1 })
    .lean<Record<string, unknown>[]>();
  return docs.map(serializeSummary);
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
    }).lean<Record<string, unknown>>();
  if (!doc) notFound();

  return {
    ...serializeSummary(doc),
    projectId,
    content: doc.content ?? null,
    version: (doc.version as number) ?? 0,
  };
});
