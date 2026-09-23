import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db";
import { Project } from "@/lib/models/project";
import type { ProjectType, SectionId } from "@/lib/project-config";
import { normalizeProjectType } from "@/lib/project-config";
import {
  DEFAULT_MANUSCRIPT_SETTINGS,
  type ManuscriptSettings,
} from "@/lib/manuscript-config";
import type { ChapterNumberingStyle } from "@/lib/chapter-numbering";
import type { TrimSizeId } from "@/lib/export-config";

export type SerializedProject = {
  id: string;
  title: string;
  type: ProjectType;
  genre?: string;
  blurb?: string;
  authorName?: string;
  coverFrontUrl?: string;
  coverBackUrl?: string;
  chapterNumberingStyle: ChapterNumberingStyle;
  chapterNumberingPrefix?: string;
  exportTrimSize: TrimSizeId;
  targetWordCount?: number;
  dailyWordGoal: number;
  sections: SectionId[];
  manuscriptSettings: ManuscriptSettings;
  createdAt: string;
  updatedAt: string;
};

function serializeProject(doc: Record<string, unknown>): SerializedProject {
  const rawSettings = (doc.manuscriptSettings as Partial<ManuscriptSettings>) ?? {};
  return {
    id: String(doc._id),
    title: doc.title as string,
    type: normalizeProjectType(doc.type as string),
    genre: (doc.genre as string) || undefined,
    blurb: (doc.blurb as string) || undefined,
    authorName: (doc.authorName as string) || undefined,
    coverFrontUrl: (doc.coverFrontUrl as string) || undefined,
    coverBackUrl: (doc.coverBackUrl as string) || undefined,
    chapterNumberingStyle: ((doc.chapterNumberingStyle as string) || "numeral") as ChapterNumberingStyle,
    chapterNumberingPrefix: (doc.chapterNumberingPrefix as string) || undefined,
    exportTrimSize: ((doc.exportTrimSize as string) || "6x9") as TrimSizeId,
    targetWordCount: (doc.targetWordCount as number) || undefined,
    dailyWordGoal: (doc.dailyWordGoal as number) ?? 300,
    sections: (doc.sections as SectionId[]) ?? [],
    manuscriptSettings: { ...DEFAULT_MANUSCRIPT_SETTINGS, ...rawSettings },
    createdAt: new Date(doc.createdAt as string).toISOString(),
    updatedAt: new Date(doc.updatedAt as string).toISOString(),
  };
}

/** Redirects to /login if unauthenticated — use in server components/actions. */
export async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user.id;
}

/** Loads a project by id, 404s if missing/invalid, redirects to /login if not the owner's. */
export const requireProject = cache(async (id: string): Promise<SerializedProject> => {
  const userId = await requireUserId();
  await connectDB();

  let doc: Record<string, unknown> | null;
  try {
    doc = await Project.findOne({ _id: id, ownerId: userId }).lean<Record<string, unknown>>();
  } catch {
    // Malformed ObjectId (e.g. a garbage URL) — treat as not found, not a crash.
    notFound();
  }
  if (!doc) notFound();
  return serializeProject(doc);
});
