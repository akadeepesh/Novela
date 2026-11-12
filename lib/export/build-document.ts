import { listChapterRecords } from "@/lib/store/chapters";
import { listCharacterRecords, listPlotThreadRecords, listWorldEntryRecords } from "@/lib/store/bible";
import { listNotesForProject, listResearchEntriesForProject } from "@/lib/store/notes";
import { characterRoleLabel } from "@/lib/character-config";
import { worldEntryTypeLabel } from "@/lib/world-config";
import { plotStatusLabel } from "@/lib/plot-config";
import { CHAPTER_LABEL_SINGULAR } from "@/lib/project-config";
import { chapterNumberLabel } from "@/lib/chapter-numbering";
import type { SectionId } from "@/lib/project-config";
import type { SerializedProject } from "@/lib/store/projects";
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
  options: ExportOptions
): Promise<ExportDocument> {
  const chapters = await listChapterRecords(project.id);

  const manuscript: ExportSection[] = chapters.map((c, index) => ({
    id: c.id,
    title: c.title || "Untitled",
    numberLabel: chapterNumberLabel({
      style: project.chapterNumberingStyle,
      prefix: project.chapterNumberingPrefix,
      index,
      singular: CHAPTER_LABEL_SINGULAR[project.type],
    }),
    blocks: tiptapToBlocks(c.content),
  }));

  const appendices: ExportAppendix[] = [];
  const want = (id: SectionId) => options.includeSections.includes(id);

  if (want("characters")) {
    const docs = await listCharacterRecords(project.id);
    appendices.push({
      heading: "Characters",
      sections: docs.map((c) => ({
        id: c.id,
        title: c.name,
        blocks: joinBlocks(
          [
            {
              kind: "paragraph",
              runs: [
                {
                  text: characterRoleLabel(c.role ?? "supporting"),
                  marks: ["italic"],
                },
              ],
            },
          ],
          plainTextToBlocks(c.appearance),
          plainTextToBlocks(c.personality),
          plainTextToBlocks(c.backstory)
        ),
      })),
    });
  }

  if (want("world")) {
    const docs = await listWorldEntryRecords(project.id);
    appendices.push({
      heading: "World",
      sections: docs.map((w) => ({
        id: w.id,
        title: w.name,
        blocks: joinBlocks(
          [
            {
              kind: "paragraph",
              runs: [
                {
                  text: worldEntryTypeLabel(w.type ?? "location"),
                  marks: ["italic"],
                },
              ],
            },
          ],
          plainTextToBlocks(w.description)
        ),
      })),
    });
  }

  if (want("plot")) {
    const docs = await listPlotThreadRecords(project.id);
    appendices.push({
      heading: "Plot",
      sections: docs.map((p) => ({
        id: p.id,
        title: p.title,
        blocks: joinBlocks(
          [
            {
              kind: "paragraph",
              runs: [
                { text: plotStatusLabel(p.status ?? "planned"), marks: ["italic"] },
              ],
            },
          ],
          plainTextToBlocks(p.description)
        ),
      })),
    });
  }

  if (want("notes")) {
    const docs = await listNotesForProject(project.id);
    appendices.push({
      heading: "Notes",
      sections: docs.map((n) => ({
        id: n.id,
        title: n.title || "Untitled Note",
        blocks: plainTextToBlocks(n.content),
      })),
    });
  }

  if (want("research")) {
    const docs = await listResearchEntriesForProject(project.id);
    appendices.push({
      heading: "Research",
      sections: docs.map((r) => ({
        id: r.id,
        title: r.title,
        blocks: joinBlocks(
          r.url ? [{ kind: "paragraph", runs: [{ text: r.url, marks: ["italic"] }] }] : [],
          plainTextToBlocks(r.content)
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
    trimSize: project.exportTrimSize,
    backCoverBlurb: project.blurb,
    manuscript,
    appendices,
  };
}
