import { Fragment } from "react";
import { Document, Page, Text, View, StyleSheet, pdf } from "@react-pdf/renderer";
import {
  SCENE_BREAK_TEXT,
  type ExportBlock,
  type ExportDocument,
  type ExportMark,
  type ExportRun,
  type ExportSection,
} from "./document-model";
import { trimSizePagePoints, trimSizeMarginPoints } from "@/lib/export-config";

function buildStyles(trimSize: string) {
  const margin = trimSizeMarginPoints(trimSize);
  return StyleSheet.create({
    page: {
      paddingTop: margin.top,
      paddingBottom: margin.bottom,
      paddingHorizontal: margin.horizontal,
      fontFamily: "Times-Roman",
      fontSize: 11.5,
    },
    titlePage: { flex: 1, alignItems: "center", justifyContent: "center" },
    title: { fontFamily: "Times-Bold", fontSize: 26, textAlign: "center", marginBottom: 16 },
    author: { fontSize: 14, textAlign: "center", marginBottom: 40 },
    dedication: { fontFamily: "Times-Italic", fontSize: 12, textAlign: "center" },
    sectionNumber: {
      fontSize: 11,
      textAlign: "center",
      color: "#666",
      letterSpacing: 1,
      marginBottom: 4,
    },
    h1: { fontFamily: "Times-Bold", fontSize: 18, marginBottom: 18, marginTop: 4 },
    sectionTitle: { fontFamily: "Times-Bold", fontSize: 18, marginBottom: 18, marginTop: 4, textAlign: "center" },
    h2: { fontFamily: "Times-Bold", fontSize: 14, marginTop: 16, marginBottom: 8 },
    h3: { fontFamily: "Times-Bold", fontSize: 12, marginTop: 12, marginBottom: 6 },
    paragraph: { marginBottom: 10, lineHeight: 1.5 },
    blockquote: { marginVertical: 8, marginHorizontal: 18 },
    blockquoteText: { fontFamily: "Times-Italic", lineHeight: 1.5 },
    listItem: { flexDirection: "row", marginBottom: 6, lineHeight: 1.5 },
    listMarker: { width: 18 },
    listText: { flex: 1 },
    sceneBreak: { textAlign: "center", marginVertical: 14 },
    tocEntry: { marginBottom: 6 },
    header: { position: "absolute", top: 28, left: margin.horizontal, right: margin.horizontal, fontSize: 9, textAlign: "center", color: "#666" },
    footer: { position: "absolute", bottom: 24, left: margin.horizontal, right: margin.horizontal, fontSize: 9, textAlign: "center", color: "#666" },
    backCover: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
    backCoverText: { fontSize: 12.5, lineHeight: 1.6, textAlign: "center" },
  });
}

type Styles = ReturnType<typeof buildStyles>;

function fontFor(marks: ExportMark[]): string {
  const bold = marks.includes("bold");
  const italic = marks.includes("italic");
  if (bold && italic) return "Times-BoldItalic";
  if (bold) return "Times-Bold";
  if (italic) return "Times-Italic";
  return "Times-Roman";
}

function decorationFor(marks: ExportMark[]) {
  const underline = marks.includes("underline");
  const strike = marks.includes("strike");
  if (underline && strike) return "underline line-through" as const;
  if (underline) return "underline" as const;
  if (strike) return "line-through" as const;
  return undefined;
}

function Runs({ runs }: { runs: ExportRun[] }) {
  return (
    <>
      {runs.map((run, i) =>
        "break" in run ? (
          <Text key={i}>{"\n"}</Text>
        ) : (
          <Text key={i} style={{ fontFamily: fontFor(run.marks), textDecoration: decorationFor(run.marks) }}>
            {run.text}
          </Text>
        )
      )}
    </>
  );
}

function Block({ block, styles }: { block: ExportBlock; styles: Styles }) {
  if (block.kind === "heading") {
    const style = block.level === 1 ? styles.h1 : block.level === 2 ? styles.h2 : styles.h3;
    return (
      <Text style={[style, block.align ? { textAlign: block.align } : {}]}>
        <Runs runs={block.runs} />
      </Text>
    );
  }
  if (block.kind === "sceneBreak") {
    return <Text style={styles.sceneBreak}>{SCENE_BREAK_TEXT}</Text>;
  }
  if (block.kind === "listItem") {
    return (
      <View style={[styles.listItem, { marginLeft: block.depth * 18 }]} wrap={false}>
        <Text style={styles.listMarker}>{block.ordered ? `${block.number}.` : "\u2022"}</Text>
        <Text style={styles.listText}>
          <Runs runs={block.runs} />
        </Text>
      </View>
    );
  }
  if (block.kind === "blockquote") {
    return (
      <View style={styles.blockquote}>
        <Text style={styles.blockquoteText}>
          <Runs runs={block.runs} />
        </Text>
      </View>
    );
  }
  return (
    <Text style={[styles.paragraph, block.align ? { textAlign: block.align } : {}]}>
      <Runs runs={block.runs} />
    </Text>
  );
}

function HeaderFooter({
  headerText,
  footerText,
  styles,
}: {
  headerText?: string;
  footerText?: string;
  styles: Styles;
}) {
  return (
    <>
      {headerText ? (
        <Text style={styles.header} fixed>
          {headerText}
        </Text>
      ) : null}
      <Text
        style={styles.footer}
        fixed
        render={({ pageNumber }) => (footerText ? `${footerText}   ·   ${pageNumber}` : `${pageNumber}`)}
      />
    </>
  );
}

function SectionPage({
  section,
  doc,
  pageSize,
  styles,
}: {
  section: ExportSection;
  doc: ExportDocument;
  pageSize: [number, number];
  styles: Styles;
}) {
  return (
    <Page size={pageSize} style={styles.page} wrap>
      <HeaderFooter headerText={doc.headerText} footerText={doc.footerText} styles={styles} />
      {section.numberLabel ? <Text style={styles.sectionNumber}>{section.numberLabel.toUpperCase()}</Text> : null}
      <Text style={styles.sectionTitle}>{section.title}</Text>
      {section.blocks.map((block, i) => (
        <Block key={i} block={block} styles={styles} />
      ))}
    </Page>
  );
}

function ExportPdfDocument({ doc }: { doc: ExportDocument }) {
  const pageSize = trimSizePagePoints(doc.trimSize);
  const styles = buildStyles(doc.trimSize);

  return (
    <Document title={doc.title} author={doc.authorName}>
      {doc.includeTitlePage ? (
        <Page size={pageSize} style={styles.page}>
          <View style={styles.titlePage}>
            <Text style={styles.title}>{doc.title}</Text>
            {doc.authorName ? <Text style={styles.author}>{doc.authorName}</Text> : null}
            {doc.dedication ? <Text style={styles.dedication}>{doc.dedication}</Text> : null}
          </View>
        </Page>
      ) : null}

      {doc.includeTOC && doc.manuscript.length > 0 ? (
        <Page size={pageSize} style={styles.page}>
          <Text style={styles.h1}>Contents</Text>
          {doc.manuscript.map((section) => (
            <Text key={section.id} style={styles.tocEntry}>
              {section.numberLabel ? `${section.numberLabel}   ·   ` : ""}
              {section.title}
            </Text>
          ))}
        </Page>
      ) : null}

      {doc.manuscript.map((section) => (
        <SectionPage key={section.id} section={section} doc={doc} pageSize={pageSize} styles={styles} />
      ))}

      {doc.appendices.map((appendix) => (
        <Page key={appendix.heading} size={pageSize} style={styles.page} wrap>
          <HeaderFooter headerText={doc.headerText} footerText={doc.footerText} styles={styles} />
          <Text style={styles.h1}>{appendix.heading}</Text>
          {appendix.sections.map((section) => (
            <Fragment key={section.id}>
              <Text style={styles.h2}>{section.title}</Text>
              {section.blocks.map((block, i) => (
                <Block key={i} block={block} styles={styles} />
              ))}
            </Fragment>
          ))}
        </Page>
      ))}

      {doc.backCoverBlurb ? (
        <Page size={pageSize} style={styles.page}>
          <View style={styles.backCover}>
            <Text style={styles.backCoverText}>{doc.backCoverBlurb}</Text>
          </View>
        </Page>
      ) : null}
    </Document>
  );
}

export async function renderPdf(doc: ExportDocument): Promise<Blob> {
  return pdf(<ExportPdfDocument doc={doc} />).toBlob();
}
