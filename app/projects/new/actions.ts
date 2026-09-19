"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { Project } from "@/lib/models/project";
import { requireUserId } from "@/lib/projects";
import { PROJECT_TYPES, getDefaultSections, type ProjectType } from "@/lib/project-config";

const typeValues = PROJECT_TYPES.map((t) => t.value) as [ProjectType, ...ProjectType[]];

const schema = z.object({
  title: z.string().trim().min(1, "Give your project a title").max(200),
  type: z.enum(typeValues),
  genre: z.string().trim().max(60).optional(),
  blurb: z.string().trim().max(2000).optional(),
  includeStoryBible: z.boolean().optional(),
});

export type NewProjectState = {
  fieldErrors?: Partial<Record<"title" | "type", string>>;
};

export async function createProjectAction(
  _prevState: NewProjectState,
  formData: FormData
): Promise<NewProjectState> {
  const userId = await requireUserId();

  const parsed = schema.safeParse({
    title: formData.get("title"),
    type: formData.get("type"),
    genre: (formData.get("genre") as string) || undefined,
    blurb: (formData.get("blurb") as string) || undefined,
    includeStoryBible: formData.get("includeStoryBible") === "on",
  });

  if (!parsed.success) {
    const fieldErrors: NewProjectState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as "title" | "type";
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { fieldErrors };
  }

  const { title, type, genre, blurb, includeStoryBible } = parsed.data;
  const sections = getDefaultSections(type, !!includeStoryBible);

  await connectDB();
  const project = await Project.create({
    ownerId: userId,
    title,
    type,
    genre,
    blurb,
    sections,
  });

  redirect(`/projects/${project._id}`);
}
