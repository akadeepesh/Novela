import "server-only";
import { Fragment } from "react";
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import type { ExportBlock, ExportDocument, ExportRun, ExportSection } from "./document-model";

// Trade-paperback trim size (6in x 9in) in points.
const PAGE_SIZE: [number, number] = [432, 648];

const styles = StyleSheet.create({
  page: { paddingTop: 64, paddingBottom: 56, paddingHorizontal: 56, fontFamily: "Times-Roman", fontSize: 11.5 },
  titlePage: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: "Times-Bold", fontSize: 26, textAlign: "center", marginBottom: 16 },
  author: { fontSize: 14, textAlign: "center", marginBottom: 40 },
  dedication: { fontFamily: "Times-Italic", fontSize: 12, textAlign: "center" },
  h1: { fontFamily: "Times-Bold", fontSize: 18, marginBottom: 18, marginTop: 4 },
  h2: { fontFamily: "Times-Bold", fontSize: 14, marginTop: 16, marginBottom: 8 },
  h3: { fontFamily: "Times-Bold", fontSize: 12, marginTop: 12, marginBottom: 6 },
  paragraph: { marginBottom: 10, lineHeight: 1.5 },
  blockquote: { marginVertical: 8, marginHorizontal: 18 },
  blockquoteText: { fontFamily: "Times-Italic", lineHeight: 1.5 },
  tocEntry: { marginBottom: 6 },
  header: { position: "absolute", top: 28, left: 56, right: 56, fontSize: 9, textAlign: "center", color: "#666" },
  footer: { position: "absolute", bottom: 24, left: 56, right: 56, fontSize: 9, textAlign: "center", color: "#666" },
});

function fontFor(marks: ("bold" | "italic")[]): string {
  const bold = marks.includes("bold");
  const italic = marks.includes("italic");
  if (bold && italic) return "Times-BoldItalic";
  if (bold) return "Times-Bold";
  if (italic) return "Times-Italic";
  return "Times-Roman";
}

function Runs({ runs }: { runs: ExportRun[] }) {
  return (
    <>
      {runs.map((run, i) =>
        "break" in run ? (
          <Text key={i}>{"\n"}</Text>
        ) : (
          <Text key={i} style={{ fontFamily: fontFor(run.marks) }}>
            {run.text}
          </Text>
        )
      )}
    </>
  );
}

function Block({ block }: { block: ExportBlock }) {
  if (block.kind === "heading") {
    const style = block.level === 1 ? styles.h1 : block.level === 2 ? styles.h2 : styles.h3;
    return (
      <Text style={style}>
        <Runs runs={block.runs} />
      </Text>
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
    <Text style={styles.paragraph}>
      <Runs runs={block.runs} />
    </Text>
  );
}

function HeaderFooter({ headerText, footerText }: { headerText?: string; footerText?: string }) {
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

function SectionPage({ section, doc }: { section: ExportSection; doc: ExportDocument }) {
  return (
    <Page size={PAGE_SIZE} style={styles.page} wrap>
      <HeaderFooter headerText={doc.headerText} footerText={doc.footerText} />
      <Text style={styles.h1}>{section.title}</Text>
      {section.blocks.map((block, i) => (
        <Block key={i} block={block} />
      ))}
    </Page>
  );
}

function ExportPdfDocument({ doc }: { doc: ExportDocument }) {
  return (
    <Document title={doc.title} author={doc.authorName}>
      {doc.includeTitlePage ? (
        <Page size={PAGE_SIZE} style={styles.page}>
          <View style={styles.titlePage}>
            <Text style={styles.title}>{doc.title}</Text>
            {doc.authorName ? <Text style={styles.author}>{doc.authorName}</Text> : null}
            {doc.dedication ? <Text style={styles.dedication}>{doc.dedication}</Text> : null}
          </View>
        </Page>
      ) : null}

      {doc.includeTOC && doc.manuscript.length > 0 ? (
        <Page size={PAGE_SIZE} style={styles.page}>
          <Text style={styles.h1}>Contents</Text>
          {doc.manuscript.map((section) => (
            <Text key={section.id} style={styles.tocEntry}>
              {section.title}
            </Text>
          ))}
        </Page>
      ) : null}

      {doc.manuscript.map((section) => (
        <SectionPage key={section.id} section={section} doc={doc} />
      ))}

      {doc.appendices.map((appendix) => (
        <Page key={appendix.heading} size={PAGE_SIZE} style={styles.page} wrap>
          <HeaderFooter headerText={doc.headerText} footerText={doc.footerText} />
          <Text style={styles.h1}>{appendix.heading}</Text>
          {appendix.sections.map((section) => (
            <Fragment key={section.id}>
              <Text style={styles.h2}>{section.title}</Text>
              {section.blocks.map((block, i) => (
                <Block key={i} block={block} />
              ))}
            </Fragment>
          ))}
        </Page>
      ))}
    </Document>
  );
}

export async function renderPdf(doc: ExportDocument): Promise<Buffer> {
  return renderToBuffer(<ExportPdfDocument doc={doc} />);
}
