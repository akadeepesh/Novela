import "server-only";
import { connectDB } from "@/lib/db";
import { Project } from "@/lib/models/project";
import { Chapter } from "@/lib/models/chapter";
import { ChapterVersion } from "@/lib/models/chapter-version";
import { Character } from "@/lib/models/character";
import { WorldEntry } from "@/lib/models/world-entry";
import { PlotThread } from "@/lib/models/plot-thread";
import { Note } from "@/lib/models/note";
import { ResearchEntry } from "@/lib/models/research-entry";
import { DailyStat } from "@/lib/models/daily-stat";
import { Comment } from "@/lib/models/comment";
import { ShareLink } from "@/lib/models/share-link";
import { deleteProjectImage } from "@/lib/blob";
import { normalizeProjectType, type ProjectType } from "@/lib/project-config";
import { TRASH_DAYS } from "@/lib/trash-config";

const DAY_MS = 24 * 60 * 60 * 1000;

type PurgeableProject = {
  _id: unknown;
  coverFrontUrl?: string;
  coverBackUrl?: string;
  manuscriptSettings?: { backgroundImageUrl?: string };
};

const PURGE_FIELDS = "coverFrontUrl coverBackUrl manuscriptSettings";

/**
 * Permanently removes a project, everything in it, and its uploaded images.
 * Children go first and the project last, so if this is interrupted the
 * project is still in the Trash and the next purge simply finishes the job
 * (the other order would leave orphaned data nobody can reach).
 */
export async function purgeProject(project: PurgeableProject, userId: string) {
  const projectId = project._id;
  await Promise.all([
    Chapter.deleteMany({ projectId, ownerId: userId }),
    ChapterVersion.deleteMany({ projectId, ownerId: userId }),
    Character.deleteMany({ projectId, ownerId: userId }),
    WorldEntry.deleteMany({ projectId, ownerId: userId }),
    PlotThread.deleteMany({ projectId, ownerId: userId }),
    Note.deleteMany({ projectId, ownerId: userId }),
    ResearchEntry.deleteMany({ projectId, ownerId: userId }),
    DailyStat.deleteMany({ projectId, ownerId: userId }),
    Comment.deleteMany({ projectId, ownerId: userId }),
    ShareLink.deleteMany({ projectId, ownerId: userId }),
    deleteProjectImage(userId, project.coverFrontUrl),
    deleteProjectImage(userId, project.coverBackUrl),
    deleteProjectImage(userId, project.manuscriptSettings?.backgroundImageUrl),
  ]);
  await Project.deleteOne({ _id: projectId, ownerId: userId });
}

/** Deletes this person's projects and chapters that have been in the Trash longer than TRASH_DAYS. */
export async function purgeExpiredTrash(userId: string) {
  await connectDB();
  const cutoff = new Date(Date.now() - TRASH_DAYS * DAY_MS);
  const expired = await Project.find({ ownerId: userId, deletedAt: { $lt: cutoff } })
    .select(PURGE_FIELDS)
    .lean<PurgeableProject[]>();
  for (const project of expired) await purgeProject(project, userId);

  const expiredChapters = await Chapter.find({ ownerId: userId, deletedAt: { $lt: cutoff } })
    .select("_id")
    .lean<{ _id: unknown }[]>();
  if (expiredChapters.length > 0) {
    const chapterIds = expiredChapters.map((c) => c._id);
    await Promise.all([
      ChapterVersion.deleteMany({ chapterId: { $in: chapterIds }, ownerId: userId }),
      Comment.deleteMany({ chapterId: { $in: chapterIds }, ownerId: userId }),
    ]);
    await Chapter.deleteMany({ _id: { $in: chapterIds }, ownerId: userId });
  }
}

/** Finds one trashed project of this person (for restore / delete forever). */
export async function findTrashedProject(projectId: string, userId: string) {
  await connectDB();
  return Project.findOne({ _id: projectId, ownerId: userId, deletedAt: { $ne: null } })
    .select(PURGE_FIELDS)
    .lean<PurgeableProject | null>();
}

export type TrashedProject = {
  id: string;
  title: string;
  type: ProjectType;
  deletedAt: string;
  daysLeft: number;
};

export async function getTrashedProjects(userId: string): Promise<TrashedProject[]> {
  await connectDB();
  const docs = await Project.find({ ownerId: userId, deletedAt: { $ne: null } })
    .select("title type deletedAt")
    .sort({ deletedAt: -1 })
    .lean<{ _id: unknown; title: string; type: string; deletedAt: Date }[]>();
  const now = Date.now();
  return docs.map((d) => ({
    id: String(d._id),
    title: d.title,
    type: normalizeProjectType(d.type),
    deletedAt: new Date(d.deletedAt).toISOString(),
    daysLeft: Math.max(0, Math.ceil((new Date(d.deletedAt).getTime() + TRASH_DAYS * DAY_MS - now) / DAY_MS)),
  }));
}

/** Purges expired items, then returns how many projects are left in the Trash. */
export async function getTrashCount(userId: string): Promise<number> {
  await purgeExpiredTrash(userId);
  return Project.countDocuments({ ownerId: userId, deletedAt: { $ne: null } });
}
