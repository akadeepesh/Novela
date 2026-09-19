import "server-only";
import { notFound } from "next/navigation";
import { connectDB } from "@/lib/db";
import { PlotThread } from "@/lib/models/plot-thread";
import { requireUserId } from "@/lib/projects";
import type { PlotStatus } from "@/lib/plot-config";

export type SerializedPlotThreadSummary = {
  id: string;
  title: string;
  status: PlotStatus;
  description?: string;
  updatedAt: string;
};

export type SerializedPlotThread = SerializedPlotThreadSummary & {
  projectId: string;
  aliases: string[];
  notes?: string;
  createdAt: string;
};

function serializeSummary(doc: Record<string, unknown>): SerializedPlotThreadSummary {
  return {
    id: String(doc._id),
    title: doc.title as string,
    status: (doc.status as PlotStatus) ?? "planned",
    description: (doc.description as string) || undefined,
    updatedAt: new Date(doc.updatedAt as string).toISOString(),
  };
}

function serializePlotThread(doc: Record<string, unknown>): SerializedPlotThread {
  return {
    ...serializeSummary(doc),
    projectId: String(doc.projectId),
    aliases: (doc.aliases as string[]) ?? [],
    notes: (doc.notes as string) || undefined,
    createdAt: new Date(doc.createdAt as string).toISOString(),
  };
}

export async function listPlotThreadsForProject(
  projectId: string
): Promise<SerializedPlotThreadSummary[]> {
  const userId = await requireUserId();
  await connectDB();
  const docs = await PlotThread.find({ projectId, ownerId: userId })
    .sort({ title: 1 })
    .lean<Record<string, unknown>[]>();
  return docs.map(serializeSummary);
}

export async function requirePlotThread(
  projectId: string,
  threadId: string
): Promise<SerializedPlotThread> {
  const userId = await requireUserId();
  await connectDB();

  let doc: Record<string, unknown> | null;
  try {
    doc = await PlotThread.findOne({
      _id: threadId,
      projectId,
      ownerId: userId,
    }).lean<Record<string, unknown>>();
  } catch {
    notFound();
  }
  if (!doc) notFound();

  return serializePlotThread(doc);
}
