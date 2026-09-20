import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { connectDB } from "@/lib/db";
import { WorldEntry } from "@/lib/models/world-entry";
import { requireUserId } from "@/lib/projects";
import type { WorldEntryType } from "@/lib/world-config";

export type SerializedWorldEntrySummary = {
  id: string;
  name: string;
  type: WorldEntryType;
  imageUrl?: string;
  description?: string;
};

export type SerializedWorldEntry = SerializedWorldEntrySummary & {
  projectId: string;
  aliases: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

function serializeSummary(doc: Record<string, unknown>): SerializedWorldEntrySummary {
  return {
    id: String(doc._id),
    name: doc.name as string,
    type: (doc.type as WorldEntryType) ?? "location",
    imageUrl: (doc.imageUrl as string) || undefined,
    description: (doc.description as string) || undefined,
  };
}

function serializeWorldEntry(doc: Record<string, unknown>): SerializedWorldEntry {
  return {
    ...serializeSummary(doc),
    projectId: String(doc.projectId),
    aliases: (doc.aliases as string[]) ?? [],
    notes: (doc.notes as string) || undefined,
    createdAt: new Date(doc.createdAt as string).toISOString(),
    updatedAt: new Date(doc.updatedAt as string).toISOString(),
  };
}

export async function listWorldEntriesForProject(
  projectId: string
): Promise<SerializedWorldEntrySummary[]> {
  const userId = await requireUserId();
  await connectDB();
  const docs = await WorldEntry.find({ projectId, ownerId: userId })
    .sort({ name: 1 })
    .lean<Record<string, unknown>[]>();
  return docs.map(serializeSummary);
}

export const requireWorldEntry = cache(async (
  projectId: string,
  entryId: string
): Promise<SerializedWorldEntry> => {
  const userId = await requireUserId();
  await connectDB();

  let doc: Record<string, unknown> | null;
  try {
    doc = await WorldEntry.findOne({
      _id: entryId,
      projectId,
      ownerId: userId,
    }).lean<Record<string, unknown>>();
  } catch {
    notFound();
  }
  if (!doc) notFound();

  return serializeWorldEntry(doc);
});
