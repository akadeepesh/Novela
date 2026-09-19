import "server-only";
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

export async function requireChapter(
  projectId: string,
  chapterId: string
): Promise<SerializedChapter> {
  const userId = await requireUserId();
  await connectDB();

  let doc: Record<string, unknown> | null;
  try {
    doc = await Chapter.findOne({
      _id: chapterId,
      projectId,
      ownerId: userId,
    }).lean<Record<string, unknown>>();
  } catch {
    notFound();
  }
  if (!doc) notFound();

  return {
    ...serializeSummary(doc),
    projectId,
    content: doc.content ?? null,
  };
}
