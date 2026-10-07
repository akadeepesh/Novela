"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { Chapter } from "@/lib/models/chapter";
import { ChapterVersion } from "@/lib/models/chapter-version";
import { requireProject, requireUserId } from "@/lib/projects";
import { sectionLabelSingular } from "@/lib/project-config";
import { initialChapterContent } from "@/lib/script-scaffold";
import { nextDefaultName } from "@/lib/default-name";
import { safeAction } from "@/lib/safe-action";

// Rewrites `order` to 0..n-1 so positions are always unique and gap-free.
// Optionally moves one chapter up/down first. Running this also heals projects
// that already have duplicate or gappy orders from earlier deletes.
// timestamps: false — reordering isn't writing, so it shouldn't move a chapter
// to the top of the dashboard's "Last worked on".
async function repackOrders(
  projectId: string,
  userId: string,
  move?: { chapterId: string; direction: "up" | "down" }
) {
  const chapters = await Chapter.find({ projectId, ownerId: userId })
    .sort({ order: 1, createdAt: 1 })
    .select("order")
    .lean<{ _id: Types.ObjectId; order: number }[]>();

  if (move) {
    const index = chapters.findIndex((c) => String(c._id) === move.chapterId);
    const target = move.direction === "up" ? index - 1 : index + 1;
    if (index !== -1 && target >= 0 && target < chapters.length) {
      [chapters[index], chapters[target]] = [chapters[target], chapters[index]];
    }
  }

  const ops = chapters.flatMap((c, i) =>
    c.order === i ? [] : [{ updateOne: { filter: { _id: c._id }, update: { $set: { order: i } } } }]
  );
  if (ops.length > 0) await Chapter.bulkWrite(ops, { timestamps: false });
}

export const createChapterAction = safeAction(
  "createChapterAction",
  async (projectId: string): Promise<void> => {
    const project = await requireProject(projectId);
    const userId = await requireUserId();
    await connectDB();

    const existing = await Chapter.find({ projectId, ownerId: userId })
      .select("title order")
      .lean<{ title: string; order: number }[]>();
    const label = sectionLabelSingular("chapters", project.type);

    // Next position after the current last one (not "how many exist", which
    // collides after a delete), and a default title nobody is already using.
    const order = existing.reduce((max, c) => Math.max(max, c.order), -1) + 1;

    const chapter = await Chapter.create({
      projectId,
      ownerId: userId,
      title: nextDefaultName(
        existing.map((c) => c.title),
        label
      ),
      order,
      content: initialChapterContent(project.type),
    });

    revalidatePath(`/projects/${projectId}/chapters`);
    redirect(`/projects/${projectId}/chapters/${chapter._id}`);
  },
  () => undefined,
  { ids: [0] }
);

export const deleteChapterAction = safeAction(
  "deleteChapterAction",
  async (projectId: string, chapterId: string) => {
    const userId = await requireUserId();
    await connectDB();
    const result = await Chapter.deleteOne({ _id: chapterId, projectId, ownerId: userId });
    if (result.deletedCount > 0) {
      // Versions of a deleted chapter would otherwise be orphaned, unreachable
      // from the UI but still taking up storage.
      await ChapterVersion.deleteMany({ chapterId, projectId, ownerId: userId });
      await repackOrders(projectId, userId);
    }
    revalidatePath(`/projects/${projectId}/chapters`);
  },
  () => undefined,
  { ids: [0, 1] }
);

export const moveChapterAction = safeAction(
  "moveChapterAction",
  async (projectId: string, chapterId: string, direction: "up" | "down") => {
    const userId = await requireUserId();
    await connectDB();
    await repackOrders(projectId, userId, { chapterId, direction });
    revalidatePath(`/projects/${projectId}/chapters`);
  },
  () => undefined,
  { ids: [0, 1] }
);
