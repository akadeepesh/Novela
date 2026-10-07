"use server";

import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import { Project } from "@/lib/models/project";
import { requireUserId } from "@/lib/projects";
import { ADDABLE_SECTIONS, SECTION_DEFS, type SectionId } from "@/lib/project-config";
import { safeAction } from "@/lib/safe-action";

export const addProjectSectionAction = safeAction(
  "addProjectSectionAction",
  async (
  projectId: string,
  sectionId: string
): Promise<{ ok: boolean }> => {
  const userId = await requireUserId();
  if (!ADDABLE_SECTIONS.includes(sectionId as SectionId) || !(sectionId in SECTION_DEFS)) {
    return { ok: false };
  }

  await connectDB();
  const project = await Project.findOne({ _id: projectId, ownerId: userId }).lean<{
    sections?: SectionId[];
  }>();
  if (!project) return { ok: false };

  const sections = project.sections ?? [];
  if (sections.includes(sectionId as SectionId)) return { ok: true };

  // Insert before "export" so Export stays the last item, matching the
  // order every project is created with.
  const exportIndex = sections.indexOf("export");
  const next = [...sections];
  next.splice(exportIndex === -1 ? next.length : exportIndex, 0, sectionId as SectionId);

  const result = await Project.updateOne(
    { _id: projectId, ownerId: userId },
    { $set: { sections: next } }
  );

  if (result.matchedCount > 0) {
    revalidatePath(`/projects/${projectId}`, "layout");
  }
  return { ok: result.matchedCount > 0 };
  },
  () => ({ ok: false }),
  { ids: [0] }
);
