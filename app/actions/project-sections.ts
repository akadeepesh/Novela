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
  // The new list is computed from the one we read, and only written if the
  // list is still exactly that one. If another add landed in between, read
  // again and retry, rather than overwriting (and losing) that section.
  for (let attempt = 0; attempt < 3; attempt++) {
    const project = await Project.findOne({ _id: projectId, ownerId: userId, deletedAt: null }).lean<{
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
      { _id: projectId, ownerId: userId, deletedAt: null, sections },
      { $set: { sections: next } }
    );
    if (result.matchedCount > 0) {
      revalidatePath(`/projects/${projectId}`, "layout");
      return { ok: true };
    }
  }
  return { ok: false };
  },
  () => ({ ok: false }),
  { ids: [0] }
);
