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
  // Auto-fetched preview metadata for "link" entries (Part 7.2's source
  // board) — captured once at save time, not re-fetched on every render.
  imageUrl?: string;
  faviconUrl?: string;
  siteName?: string;
  updatedAt: string;
};

export type SerializedResearchEntry = SerializedResearchEntrySummary & {
  projectId: string;
  createdAt: string;
};

// Exported so the URL-paste/quick-note actions (Part 7.2) can return a
// freshly-created or freshly-saved entry without a second round-trip
// through listResearchEntriesForProject.
export function serializeResearchEntrySummary(
  doc: Record<string, unknown>
): SerializedResearchEntrySummary {
  return {
    id: String(doc._id),
    title: doc.title as string,
    type: (doc.type as ResearchEntryType) ?? "note",
    url: (doc.url as string) || undefined,
    content: (doc.content as string) || undefined,
    imageUrl: (doc.imageUrl as string) || undefined,
    faviconUrl: (doc.faviconUrl as string) || undefined,
    siteName: (doc.siteName as string) || undefined,
    updatedAt: new Date(doc.updatedAt as string).toISOString(),
  };
}

function serializeResearchEntry(doc: Record<string, unknown>): SerializedResearchEntry {
  return {
    ...serializeResearchEntrySummary(doc),
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
  return docs.map(serializeResearchEntrySummary);
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
