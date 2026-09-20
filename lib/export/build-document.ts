import "server-only";
import { connectDB } from "@/lib/db";
import { Chapter } from "@/lib/models/chapter";
import { Character } from "@/lib/models/character";
import { WorldEntry } from "@/lib/models/world-entry";
import { PlotThread } from "@/lib/models/plot-thread";
import { Note } from "@/lib/models/note";
import { ResearchEntry } from "@/lib/models/research-entry";
import { characterRoleLabel, type CharacterRole } from "@/lib/character-config";
import { worldEntryTypeLabel, type WorldEntryType } from "@/lib/world-config";
import { plotStatusLabel, type PlotStatus } from "@/lib/plot-config";
import type { SectionId } from "@/lib/project-config";
import type { SerializedProject } from "@/lib/projects";
import {
  tiptapToBlocks,
  plainTextToBlocks,
  type ExportDocument,
  type ExportSection,
  type ExportAppendix,
  type ExportBlock,
} from "./document-model";

export type ExportOptions = {
  includeTitlePage: boolean;
  includeTOC: boolean;
  dedication?: string;
  // Subset of the project's optional sections to append after the
  // manuscript — chapters/overview/export are never part of this list.
  includeSections: SectionId[];
};

function joinBlocks(...groups: ExportBlock[][]): ExportBlock[] {
  return groups.flat();
}

export async function buildExportDocument(
  project: SerializedProject,
  userId: string,
  options: ExportOptions
): Promise<ExportDocument> {
  await connectDB();

  const chapters = await Chapter.find({ projectId: project.id, ownerId: userId })
    .sort({ order: 1 })
    .lean<Record<string, unknown>[]>();

  const manuscript: ExportSection[] = chapters.map((c) => ({
    id: String(c._id),
    title: (c.title as string) || "Untitled",
    blocks: tiptapToBlocks(c.content),
  }));

  const appendices: ExportAppendix[] = [];
  const want = (id: SectionId) => options.includeSections.includes(id);

  if (want("characters")) {
    const docs = await Character.find({ projectId: project.id, ownerId: userId })
      .sort({ name: 1 })
      .lean<Record<string, unknown>[]>();
    appendices.push({
      heading: "Characters",
      sections: docs.map((c) => ({
        id: String(c._id),
        title: c.name as string,
        blocks: joinBlocks(
          [
            {
              kind: "paragraph",
              runs: [
                {
                  text: characterRoleLabel((c.role as CharacterRole) ?? "supporting"),
                  marks: ["italic"],
                },
              ],
            },
          ],
          plainTextToBlocks(c.appearance as string),
          plainTextToBlocks(c.personality as string),
          plainTextToBlocks(c.backstory as string)
        ),
      })),
    });
  }

  if (want("world")) {
    const docs = await WorldEntry.find({ projectId: project.id, ownerId: userId })
      .sort({ name: 1 })
      .lean<Record<string, unknown>[]>();
    appendices.push({
      heading: "World",
      sections: docs.map((w) => ({
        id: String(w._id),
        title: w.name as string,
        blocks: joinBlocks(
          [
            {
              kind: "paragraph",
              runs: [
                {
                  text: worldEntryTypeLabel((w.type as WorldEntryType) ?? "location"),
                  marks: ["italic"],
                },
              ],
            },
          ],
          plainTextToBlocks(w.description as string)
        ),
      })),
    });
  }

  if (want("plot")) {
    const docs = await PlotThread.find({ projectId: project.id, ownerId: userId })
      .sort({ title: 1 })
      .lean<Record<string, unknown>[]>();
    appendices.push({
      heading: "Plot",
      sections: docs.map((p) => ({
        id: String(p._id),
        title: p.title as string,
        blocks: joinBlocks(
          [
            {
              kind: "paragraph",
              runs: [
                { text: plotStatusLabel((p.status as PlotStatus) ?? "planned"), marks: ["italic"] },
              ],
            },
          ],
          plainTextToBlocks(p.description as string)
        ),
      })),
    });
  }

  if (want("notes")) {
    const docs = await Note.find({ projectId: project.id, ownerId: userId })
      .sort({ pinned: -1, updatedAt: -1 })
      .lean<Record<string, unknown>[]>();
    appendices.push({
      heading: "Notes",
      sections: docs.map((n) => ({
        id: String(n._id),
        title: (n.title as string) || "Untitled Note",
        blocks: plainTextToBlocks(n.content as string),
      })),
    });
  }

  if (want("research")) {
    const docs = await ResearchEntry.find({ projectId: project.id, ownerId: userId })
      .sort({ updatedAt: -1 })
      .lean<Record<string, unknown>[]>();
    appendices.push({
      heading: "Research",
      sections: docs.map((r) => ({
        id: String(r._id),
        title: r.title as string,
        blocks: joinBlocks(
          r.url ? [{ kind: "paragraph", runs: [{ text: r.url as string, marks: ["italic"] }] }] : [],
          plainTextToBlocks(r.content as string)
        ),
      })),
    });
  }

  return {
    title: project.title,
    authorName: project.authorName,
    genre: project.genre,
    dedication: options.dedication?.trim() || undefined,
    includeTitlePage: options.includeTitlePage,
    includeTOC: options.includeTOC,
    isPoetry: project.type === "poetry",
    headerText: project.manuscriptSettings.showHeader
      ? project.manuscriptSettings.headerText || project.title
      : undefined,
    footerText: project.manuscriptSettings.showFooter
      ? project.manuscriptSettings.footerText || undefined
      : undefined,
    manuscript,
    appendices,
  };
}
