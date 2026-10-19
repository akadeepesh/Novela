import "server-only";
import JSZip from "jszip";
import { randomUUID } from "node:crypto";
import { SCENE_BREAK_TEXT, type ExportBlock, type ExportDocument, type ExportRun, type ExportSection } from "./document-model";

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function runsToHtml(runs: ExportRun[]): string {
  let html = "";
  for (const run of runs) {
    if ("break" in run) {
      html += "<br/>";
      continue;
    }
    let piece = escapeXml(run.text);
    if (run.marks.includes("bold")) piece = `<strong>${piece}</strong>`;
    if (run.marks.includes("italic")) piece = `<em>${piece}</em>`;
    if (run.marks.includes("underline")) piece = `<u>${piece}</u>`;
    if (run.marks.includes("strike")) piece = `<s>${piece}</s>`;
    html += piece;
  }
  return html;
}

function alignAttr(align: string | undefined): string {
  return align ? ` style="text-align: ${align}"` : "";
}

function blockToHtml(block: ExportBlock): string {
  if (block.kind === "heading") {
    // h1 is reserved for the chapter/section title itself.
    const tag = `h${block.level + 1}`;
    return `<${tag}${alignAttr(block.align)}>${runsToHtml(block.runs)}</${tag}>`;
  }
  if (block.kind === "blockquote") {
    return `<blockquote><p>${runsToHtml(block.runs)}</p></blockquote>`;
  }
  if (block.kind === "sceneBreak") {
    return `<p class="scene-break">${SCENE_BREAK_TEXT}</p>`;
  }
  if (block.kind === "listItem") {
    // Items are flattened (see tiptapToBlocks), so the marker is written out
    // rather than rebuilding nested <ul>/<ol> elements.
    const marker = block.ordered ? `${block.number}.` : "&#8226;";
    return `<p class="list-item" style="margin-left: ${1.5 + block.depth * 1.5}em">${marker} ${runsToHtml(block.runs)}</p>`;
  }
  return `<p${alignAttr(block.align)}>${runsToHtml(block.runs)}</p>`;
}

function sectionToXhtml(
  id: string,
  title: string,
  blocks: ExportBlock[],
  isPoetry: boolean,
  numberLabel?: string
): string {
  const bodyClass = isPoetry ? ' class="poem"' : "";
  const numberHtml = numberLabel ? `<p class="chapter-number">${escapeXml(numberLabel.toUpperCase())}</p>` : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>${escapeXml(title)}</title><link rel="stylesheet" type="text/css" href="styles.css"/></head>
<body${bodyClass}>
<section epub:type="chapter" id="${id}">
${numberHtml}
<h1>${escapeXml(title)}</h1>
${blocks.map(blockToHtml).join("\n")}
</section>
</body>
</html>`;
}

const STYLES = `
body { font-family: Georgia, "Times New Roman", serif; line-height: 1.6; margin: 1.5em; }
h1 { font-size: 1.6em; margin-bottom: 1em; }
h2 { font-size: 1.3em; }
h3 { font-size: 1.1em; }
p { margin: 0 0 1em 0; text-indent: 0; }
blockquote { margin: 1em 2em; font-style: italic; }
.scene-break { text-align: center; text-indent: 0; margin: 1.5em 0; }
.list-item { text-indent: -1.2em; margin-top: 0.2em; margin-bottom: 0.2em; }
body.poem p { white-space: pre-wrap; margin: 0 0 0.4em 0; }
.title-page { text-align: center; margin-top: 30%; }
.title-page h1 { font-size: 2em; }
.title-page .author { font-size: 1.1em; margin-top: 1em; }
.title-page .dedication { font-style: italic; margin-top: 3em; }
.chapter-number { text-align: center; letter-spacing: 0.1em; color: #666; font-size: 0.85em; margin-bottom: 0.25em; }
.back-cover { text-align: center; margin-top: 25%; font-style: italic; }
nav ol { list-style: none; padding-left: 0; }
nav li { margin-bottom: 0.5em; }
`;

type ManifestItem = { id: string; href: string; mediaType: string; xhtml?: string };

export async function renderEpub(doc: ExportDocument): Promise<Buffer> {
  const zip = new JSZip();
  const uid = `urn:uuid:${randomUUID()}`;
  const manifest: ManifestItem[] = [];
  const spineIds: string[] = [];

  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });

  zip.file(
    "META-INF/container.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`
  );

  zip.file("OEBPS/styles.css", STYLES);
  manifest.push({ id: "styles", href: "styles.css", mediaType: "text/css" });

  if (doc.includeTitlePage) {
    const html = `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>${escapeXml(doc.title)}</title><link rel="stylesheet" type="text/css" href="styles.css"/></head>
<body>
<div class="title-page">
<h1>${escapeXml(doc.title)}</h1>
${doc.authorName ? `<p class="author">${escapeXml(doc.authorName)}</p>` : ""}
${doc.dedication ? `<p class="dedication">${escapeXml(doc.dedication)}</p>` : ""}
</div>
</body>
</html>`;
    zip.file("OEBPS/title.xhtml", html);
    manifest.push({ id: "title", href: "title.xhtml", mediaType: "application/xhtml+xml" });
    spineIds.push("title");
  }

  function addSection(idPrefix: string, section: ExportSection, index: number) {
    const id = `${idPrefix}-${index}`;
    const href = `${id}.xhtml`;
    const html = sectionToXhtml(section.id, section.title, section.blocks, doc.isPoetry, section.numberLabel);
    zip.file(`OEBPS/${href}`, html);
    manifest.push({ id, href, mediaType: "application/xhtml+xml" });
    spineIds.push(id);
    return { id, title: section.numberLabel ? `${section.numberLabel} — ${section.title}` : section.title };
  }

  const manuscriptNav = doc.manuscript.map((section, i) => addSection("chapter", section, i));

  const appendixNav: { heading: string; entries: { id: string; title: string }[] }[] = [];
  doc.appendices.forEach((appendix, ai) => {
    const entries = appendix.sections.map((section, i) => addSection(`appendix-${ai}`, section, i));
    appendixNav.push({ heading: appendix.heading, entries });
  });

  const navListItems = [
    ...manuscriptNav.map((c) => `<li><a href="${c.id}.xhtml">${escapeXml(c.title)}</a></li>`),
    ...appendixNav.flatMap((group) => [
      `<li>${escapeXml(group.heading)}<ol>`,
      ...group.entries.map((e) => `<li><a href="${e.id}.xhtml">${escapeXml(e.title)}</a></li>`),
      `</ol></li>`,
    ]),
  ].join("\n");

  const navHtml = `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>Contents</title><link rel="stylesheet" type="text/css" href="styles.css"/></head>
<body>
<nav epub:type="toc" id="toc"><h1>Contents</h1><ol>
${navListItems}
</ol></nav>
</body>
</html>`;
  zip.file("OEBPS/nav.xhtml", navHtml);
  manifest.push({ id: "nav", href: "nav.xhtml", mediaType: "application/xhtml+xml" });

  // A printed "Contents" page in the reading flow itself, in addition to
  // the reader's own TOC panel (which nav.xhtml above always powers).
  if (doc.includeTOC && manuscriptNav.length > 0) {
    const contentsHtml = `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Contents</title><link rel="stylesheet" type="text/css" href="styles.css"/></head>
<body>
<h1>Contents</h1>
<ol>
${manuscriptNav.map((c) => `<li><a href="${c.id}.xhtml">${escapeXml(c.title)}</a></li>`).join("\n")}
</ol>
</body>
</html>`;
    zip.file("OEBPS/contents.xhtml", contentsHtml);
    manifest.push({ id: "contents", href: "contents.xhtml", mediaType: "application/xhtml+xml" });
    spineIds.splice(doc.includeTitlePage ? 1 : 0, 0, "contents");
  }

  if (doc.backCoverBlurb) {
    const backCoverHtml = `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>${escapeXml(doc.title)}</title><link rel="stylesheet" type="text/css" href="styles.css"/></head>
<body>
<p class="back-cover">${escapeXml(doc.backCoverBlurb)}</p>
</body>
</html>`;
    zip.file("OEBPS/back-cover.xhtml", backCoverHtml);
    manifest.push({ id: "back-cover", href: "back-cover.xhtml", mediaType: "application/xhtml+xml" });
    spineIds.push("back-cover");
  }

  const manifestXml = manifest
    .map((m) => `<item id="${m.id}" href="${m.href}" media-type="${m.mediaType}"${m.id === "nav" ? ' properties="nav"' : ""}/>`)
    .join("\n");
  const spineXml = spineIds.map((id) => `<itemref idref="${id}"/>`).join("\n");

  const opf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">${uid}</dc:identifier>
    <dc:title>${escapeXml(doc.title)}</dc:title>
    ${doc.authorName ? `<dc:creator>${escapeXml(doc.authorName)}</dc:creator>` : ""}
    ${doc.genre ? `<dc:subject>${escapeXml(doc.genre)}</dc:subject>` : ""}
    <dc:language>en</dc:language>
    <meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d+Z$/, "Z")}</meta>
  </metadata>
  <manifest>
${manifestXml}
  </manifest>
  <spine>
${spineXml}
  </spine>
</package>`;
  zip.file("OEBPS/content.opf", opf);

  const buffer = await zip.generateAsync({ type: "nodebuffer", mimeType: "application/epub+zip" });
  return buffer;
}
