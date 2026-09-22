import "server-only";
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

  // "Most recently edited" means most recently edited CONTENT, not just
  // any project field — so this is driven by the single most-recently
  // updated chapter across every project, not project.updatedAt (which
  // also changes on unrelated edits like the title or manuscript settings).
  const latestChapter = await Chapter.findOne({ ownerId: userId })
    .select("projectId title updatedAt")
    .sort({ updatedAt: -1 })
    .lean<{ _id: unknown; projectId: unknown; title: string; updatedAt: Date }>();

  let heroProject = latestChapter
    ? projects.find((p) => String(p._id) === String(latestChapter.projectId))
    : undefined;

  // No chapters anywhere yet (shouldn't normally happen now that creation
  // always makes a first chapter, but stays correct for older/edge-case
  // data) — fall back to the most recently updated project.
  if (!heroProject) {
    heroProject = [...projects].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )[0];
  }

  const hero: DashboardHero = {
    id: String(heroProject._id),
    title: heroProject.title,
    type: normalizeProjectType(heroProject.type),
    chapter:
      latestChapter && String(latestChapter.projectId) === String(heroProject._id)
        ? {
            id: String(latestChapter._id),
            title: latestChapter.title,
            updatedAt: latestChapter.updatedAt.toISOString(),
          }
        : null,
  };

  const others: DashboardOther[] = projects
    .filter((p) => String(p._id) !== hero.id)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .map((p) => ({
      id: String(p._id),
      title: p.title,
      type: normalizeProjectType(p.type),
      updatedAt: p.updatedAt.toISOString(),
    }));

  return { hero, others };
}
