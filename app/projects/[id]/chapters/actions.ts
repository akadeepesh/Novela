"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import { Chapter } from "@/lib/models/chapter";
import { requireProject, requireUserId } from "@/lib/projects";
import { sectionLabelSingular } from "@/lib/project-config";
import { initialChapterContent } from "@/lib/script-scaffold";

export async function createChapterAction(projectId: string) {
  const project = await requireProject(projectId);
  const userId = await requireUserId();
  await connectDB();

  const count = await Chapter.countDocuments({ projectId });
  const label = sectionLabelSingular("chapters", project.type);

  const chapter = await Chapter.create({
    projectId,
    ownerId: userId,
    title: `${label} ${count + 1}`,
    order: count,
    content: initialChapterContent(project.type),
  });

  revalidatePath(`/projects/${projectId}/chapters`);
  redirect(`/projects/${projectId}/chapters/${chapter._id}`);
}

export async function deleteChapterAction(projectId: string, chapterId: string) {
  const userId = await requireUserId();
  await connectDB();
  await Chapter.deleteOne({ _id: chapterId, projectId, ownerId: userId });
  revalidatePath(`/projects/${projectId}/chapters`);
}

export async function moveChapterAction(
  projectId: string,
  chapterId: string,
  direction: "up" | "down"
) {
  const userId = await requireUserId();
  await connectDB();

  const chapters = await Chapter.find({ projectId, ownerId: userId })
    .sort({ order: 1 })
    .lean<{ _id: unknown; order: number }[]>();

  const index = chapters.findIndex((c) => String(c._id) === chapterId);
  if (index === -1) return;

  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= chapters.length) return;

  const current = chapters[index];
  const swapWith = chapters[swapIndex];

  // timestamps: false — reordering isn't writing, so it shouldn't move a
  // chapter to the top of the dashboard's "Last worked on".
  await Chapter.updateOne({ _id: current._id }, { order: swapWith.order }, { timestamps: false });
  await Chapter.updateOne({ _id: swapWith._id }, { order: current.order }, { timestamps: false });

  revalidatePath(`/projects/${projectId}/chapters`);
}
