"use server";

import { connectDB } from "@/lib/db";
import { Project } from "@/lib/models/project";
import { Chapter } from "@/lib/models/chapter";
import { requireUserId } from "@/lib/projects";
import {
  PROJECT_TYPES,
  STORY_BIBLE_OPTIONAL_TYPES,
  defaultProjectTitle,
  getDefaultSections,
  sectionLabelSingular,
  type ProjectType,
  type SectionId,
} from "@/lib/project-config";
import { initialChapterContent } from "@/lib/script-scaffold";

const TYPE_VALUES = PROJECT_TYPES.map((t) => t.value) as ProjectType[];
const STORY_BIBLE_SECTIONS: SectionId[] = ["characters", "world", "plot"];

function isProjectType(value: unknown): value is ProjectType {
  return typeof value === "string" && (TYPE_VALUES as string[]).includes(value);
}

/**
 * Shape used with `useActionState`: `fieldErrors` surfaces validation
 * problems back onto the form, `result` carries the new ids once creation
 * succeeds (the client animates before navigating, rather than this action
 * redirecting directly).
 */
export type NewProjectState = {
  fieldErrors?: {
    title?: string;
  };
  result?: {
    projectId: string;
    chapterId: string;
  };
};

/**
 * Deliberately light on required input — a blank title just becomes
 * "Untitled X", there's no wrong answer there. Genre and blurb are
 * optional and land straight on the Overview page; Characters/World/Plot
 * are included by default for "novel" and otherwise only when the
 * "includeStoryBible" checkbox was checked (see STORY_BIBLE_OPTIONAL_TYPES).
 */
export async function createProjectAction(
  _prevState: NewProjectState,
  formData: FormData
): Promise<NewProjectState> {
  const userId = await requireUserId();

  const rawType = formData.get("type");
  const type = isProjectType(rawType) ? rawType : "novel";
  const title =
    String(formData.get("title") ?? "").trim().slice(0, 200) || defaultProjectTitle(type);
  const genre = String(formData.get("genre") ?? "").trim();
  const blurb = String(formData.get("blurb") ?? "").trim();
  const includeStoryBible = formData.get("includeStoryBible") === "on";

  const sections = getDefaultSections(type);
  if (STORY_BIBLE_OPTIONAL_TYPES.includes(type) && includeStoryBible) {
    for (const section of STORY_BIBLE_SECTIONS) {
      if (!sections.includes(section)) sections.push(section);
    }
  }

  await connectDB();
  const project = await Project.create({
    ownerId: userId,
    title,
    type,
    sections,
    ...(genre ? { genre } : {}),
    ...(blurb ? { blurb } : {}),
  });

  const chapterLabel = sectionLabelSingular("chapters", type);
  const chapter = await Chapter.create({
    projectId: project._id,
    ownerId: userId,
    title: `${chapterLabel} 1`,
    order: 0,
    content: initialChapterContent(type),
  });

  return { result: { projectId: String(project._id), chapterId: String(chapter._id) } };
}
