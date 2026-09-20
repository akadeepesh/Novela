import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { connectDB } from "@/lib/db";
import { ResearchEntry } from "@/lib/models/research-entry";
import { requireUserId } from "@/lib/projects";
import type { ResearchEntryType } from "@/lib/research-config";

export type SerializedResearchEntrySummary = {
  id: string;
  title: string;
  type: ResearchEntryType;
  url?: string;
  content?: string;
  updatedAt: string;
};

export type SerializedResearchEntry = SerializedResearchEntrySummary & {
  projectId: string;
  createdAt: string;
};

function serializeSummary(doc: Record<string, unknown>): SerializedResearchEntrySummary {
  return {
    id: String(doc._id),
    title: doc.title as string,
    type: (doc.type as ResearchEntryType) ?? "note",
    url: (doc.url as string) || undefined,
    content: (doc.content as string) || undefined,
    updatedAt: new Date(doc.updatedAt as string).toISOString(),
  };
}

function serializeResearchEntry(doc: Record<string, unknown>): SerializedResearchEntry {
  return {
    ...serializeSummary(doc),
    projectId: String(doc.projectId),
    createdAt: new Date(doc.createdAt as string).toISOString(),
  };
}

export async function listResearchEntriesForProject(
  projectId: string
): Promise<SerializedResearchEntrySummary[]> {
  const userId = await requireUserId();
  await connectDB();
  const docs = await ResearchEntry.find({ projectId, ownerId: userId })
    .sort({ updatedAt: -1 })
    .lean<Record<string, unknown>[]>();
  return docs.map(serializeSummary);
}

export const requireResearchEntry = cache(async (
  projectId: string,
  entryId: string
): Promise<SerializedResearchEntry> => {
  const userId = await requireUserId();
  await connectDB();

  let doc: Record<string, unknown> | null;
  try {
    doc = await ResearchEntry.findOne({
      _id: entryId,
      projectId,
      ownerId: userId,
    }).lean<Record<string, unknown>>();
  } catch {
    notFound();
  }
  if (!doc) notFound();

  return serializeResearchEntry(doc);
});
