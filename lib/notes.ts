import "server-only";
import { notFound } from "next/navigation";
import { connectDB } from "@/lib/db";
import { Note } from "@/lib/models/note";
import { requireUserId } from "@/lib/projects";

export type SerializedNoteSummary = {
  id: string;
  title: string;
  content?: string;
  tags: string[];
  pinned: boolean;
  updatedAt: string;
};

export type SerializedNote = SerializedNoteSummary & {
  projectId: string;
  createdAt: string;
};

function serializeSummary(doc: Record<string, unknown>): SerializedNoteSummary {
  return {
    id: String(doc._id),
    title: doc.title as string,
    content: (doc.content as string) || undefined,
    tags: (doc.tags as string[]) ?? [],
    pinned: Boolean(doc.pinned),
    updatedAt: new Date(doc.updatedAt as string).toISOString(),
  };
}

function serializeNote(doc: Record<string, unknown>): SerializedNote {
  return {
    ...serializeSummary(doc),
    projectId: String(doc.projectId),
    createdAt: new Date(doc.createdAt as string).toISOString(),
  };
}

export async function listNotesForProject(projectId: string): Promise<SerializedNoteSummary[]> {
  const userId = await requireUserId();
  await connectDB();
  const docs = await Note.find({ projectId, ownerId: userId })
    .sort({ pinned: -1, updatedAt: -1 })
    .lean<Record<string, unknown>[]>();
  return docs.map(serializeSummary);
}

export async function requireNote(projectId: string, noteId: string): Promise<SerializedNote> {
  const userId = await requireUserId();
  await connectDB();

  let doc: Record<string, unknown> | null;
  try {
    doc = await Note.findOne({ _id: noteId, projectId, ownerId: userId }).lean<
      Record<string, unknown>
    >();
  } catch {
    notFound();
  }
  if (!doc) notFound();

  return serializeNote(doc);
}
