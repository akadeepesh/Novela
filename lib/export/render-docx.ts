import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  PageBreak,
  Packer,
  Header,
  Footer,
  PageNumber,
} from "docx";
import {
  SCENE_BREAK_TEXT,
  type ExportAlign,
  type ExportBlock,
  type ExportDocument,
  type ExportRun,
  type ExportSection,
} from "./document-model";

const DOCX_ALIGN: Record<ExportAlign, (typeof AlignmentType)[keyof typeof AlignmentType]> = {
  center: AlignmentType.CENTER,
  right: AlignmentType.RIGHT,
  justify: AlignmentType.JUSTIFIED,
};

function toTextRuns(runs: ExportRun[]): TextRun[] {
  const out: TextRun[] = [];
  for (const run of runs) {
    if ("break" in run) {
      out.push(new TextRun({ text: "", break: 1 }));
    } else {
      out.push(
        new TextRun({
          text: run.text,
          bold: run.marks.includes("bold"),
          italics: run.marks.includes("italic"),
          underline: run.marks.includes("underline") ? {} : undefined,
          strike: run.marks.includes("strike"),
        })
      );
    }
  }
  return out;
}

function blockToParagraph(block: ExportBlock): Paragraph {
  if (block.kind === "heading") {
    const headingLevel = {
      1: HeadingLevel.HEADING_1,
      2: HeadingLevel.HEADING_2,
      3: HeadingLevel.HEADING_3,
    }[block.level];
    return new Paragraph({
      heading: headingLevel,
      alignment: block.align ? DOCX_ALIGN[block.align] : undefined,
      spacing: { before: 240, after: 120 },
      children: toTextRuns(block.runs),
    });
  }
  if (block.kind === "sceneBreak") {
    return new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 240, after: 240 },
      children: [new TextRun({ text: SCENE_BREAK_TEXT })],
    });
  }
  if (block.kind === "listItem") {
    return new Paragraph({
      indent: { left: 720 + block.depth * 360, hanging: 360 },
      spacing: { after: 80 },
      children: [new TextRun({ text: `${block.ordered ? `${block.number}.` : "\u2022"}\t` }), ...toTextRuns(block.runs)],
    });
  }
  if (block.kind === "blockquote") {
    return new Paragraph({
      indent: { left: 720 },
      spacing: { before: 120, after: 120 },
      children: toTextRuns(block.runs),
    });
  }
  return new Paragraph({
    alignment: block.align ? DOCX_ALIGN[block.align] : undefined,
    spacing: { after: 160 },
    children: toTextRuns(block.runs),
  });
}

function sectionToParagraphs(
  section: ExportSection,
  headingLevel: (typeof HeadingLevel)[keyof typeof HeadingLevel]
): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  if (section.numberLabel) {
    paragraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 400, after: 40 },
        children: [new TextRun({ text: section.numberLabel.toUpperCase(), size: 18, color: "666666" })],
      })
    );
  }
  paragraphs.push(
    new Paragraph({
      heading: headingLevel,
      alignment: section.numberLabel ? AlignmentType.CENTER : undefined,
      spacing: { before: section.numberLabel ? 0 : 400, after: 200 },
      children: [new TextRun({ text: section.title, bold: true })],
    })
  );
  paragraphs.push(...section.blocks.map(blockToParagraph));
  return paragraphs;
}

export async function renderDocx(doc: ExportDocument): Promise<Blob> {
  const children: Paragraph[] = [];

  if (doc.includeTitlePage) {
    children.push(
      new Paragraph({
        spacing: { before: 2400 },
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: doc.title, bold: true, size: 56 })],
      })
    );
    if (doc.authorName) {
      children.push(
        new Paragraph({
          spacing: { before: 240 },
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: doc.authorName, size: 28 })],
        })
      );
    }
    if (doc.dedication) {
      children.push(
        new Paragraph({
          spacing: { before: 960 },
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: doc.dedication, italics: true })],
        })
      );
    }
    children.push(new Paragraph({ children: [new PageBreak()] }));
  }

  // A live/clickable TOC needs a Word field code that most viewers prompt
  // to "update on open" — a plain printed list is more predictable across
  // Word/Google Docs/LibreOffice, at the cost of not being interactive.
  if (doc.includeTOC && doc.manuscript.length > 0) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun({ text: "Contents", bold: true })],
      })
    );
    doc.manuscript.forEach((section) => {
      const text = section.numberLabel ? `${section.numberLabel} — ${section.title}` : section.title;
      children.push(
        new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text })] })
      );
    });
    children.push(new Paragraph({ children: [new PageBreak()] }));
  }

  doc.manuscript.forEach((section, i) => {
    if (i > 0) children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(...sectionToParagraphs(section, HeadingLevel.HEADING_1));
  });

  for (const appendix of doc.appendices) {
    children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 240, after: 200 },
        children: [new TextRun({ text: appendix.heading, bold: true })],
      })
    );
    appendix.sections.forEach((section) => {
      children.push(...sectionToParagraphs(section, HeadingLevel.HEADING_2));
    });
  }

  if (doc.backCoverBlurb) {
    children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(
      new Paragraph({
        spacing: { before: 2000 },
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: doc.backCoverBlurb, italics: true })],
      })
    );
  }

  const document = new Document({
    sections: [
      {
        properties: {},
        headers: doc.headerText
          ? {
              default: new Header({
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new TextRun({ text: doc.headerText, size: 18, allCaps: true })],
                  }),
                ],
              }),
            }
          : undefined,
        footers: doc.footerText
          ? {
              default: new Footer({
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                      new TextRun({ text: doc.footerText, size: 18 }),
                      new TextRun({ text: "   ·   ", size: 18 }),
                      new TextRun({ children: [PageNumber.CURRENT], size: 18 }),
                    ],
                  }),
                ],
              }),
            }
          : undefined,
        children,
      },
    ],
  });

  return Packer.toBlob(document);
}
