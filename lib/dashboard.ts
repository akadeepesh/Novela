import "server-only";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { Project } from "@/lib/models/project";
import { Chapter } from "@/lib/models/chapter";
import { requireUserId } from "@/lib/projects";
import type { ProjectType } from "@/lib/project-config";
import { normalizeProjectType } from "@/lib/project-config";

export type DashboardHero = {
  id: string;
  title: string;
  type: ProjectType;
  chapter: { id: string; title: string; updatedAt: string } | null;
};

export type DashboardOther = {
  id: string;
  title: string;
  type: ProjectType;
  updatedAt: string;
};

export type DashboardData = {
  hero: DashboardHero | null;
  others: DashboardOther[];
};

export async function getDashboardData(): Promise<DashboardData> {
  const userId = await requireUserId();
  await connectDB();

  const projects = await Project.find({ ownerId: userId })
    .select("title type updatedAt")
    .lean<{ _id: unknown; title: string; type: string; updatedAt: Date }[]>();

  if (projects.length === 0) return { hero: null, others: [] };

  // "Last activity" of a project = when its most recently edited chapter was
  // edited, NOT project.updatedAt (which also moves on unrelated edits such as
  // the title or manuscript settings, and never moves when you just write).
  // One grouped query gives every project's latest chapter at once, so the
  // hero and the list below it are ordered by the same rule.
  const latestByProject = await Chapter.aggregate<{
    _id: unknown;
    chapterId: unknown;
    title: string;
    updatedAt: Date;
  }>([
    { $match: { ownerId: new Types.ObjectId(userId) } },
    { $sort: { updatedAt: -1 } },
    {
      $group: {
        _id: "$projectId",
        chapterId: { $first: "$_id" },
        title: { $first: "$title" },
        updatedAt: { $first: "$updatedAt" },
      },
    },
  ]);
  const latest = new Map(latestByProject.map((c) => [String(c._id), c]));

  // Projects without chapters fall back to their own updatedAt.
  const ranked = projects
    .map((p) => {
      const chapter = latest.get(String(p._id)) ?? null;
      return { project: p, chapter, activity: new Date(chapter?.updatedAt ?? p.updatedAt) };
    })
    .sort((a, b) => b.activity.getTime() - a.activity.getTime());

  const [first, ...rest] = ranked;

  const hero: DashboardHero = {
    id: String(first.project._id),
    title: first.project.title,
    type: normalizeProjectType(first.project.type),
    chapter: first.chapter
      ? {
          id: String(first.chapter.chapterId),
          title: first.chapter.title,
          updatedAt: first.activity.toISOString(),
        }
      : null,
  };

  const others: DashboardOther[] = rest.map((r) => ({
    id: String(r.project._id),
    title: r.project.title,
    type: normalizeProjectType(r.project.type),
    updatedAt: r.activity.toISOString(),
  }));

  return { hero, others };
}
