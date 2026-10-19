import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db";
import { isObjectId } from "@/lib/object-id";
import { Project } from "@/lib/models/project";
import { DEFAULT_MANUSCRIPT_SETTINGS, type ManuscriptSettings } from "@/lib/manuscript-config";
import { normalizeProjectType, type SectionId } from "@/lib/project-config";
import type { SerializedProject } from "@/lib/projects";
import { buildExportDocument } from "@/lib/export/build-document";
import { renderDocx } from "@/lib/export/render-docx";
import { renderEpub } from "@/lib/export/render-epub";
import { renderPdf } from "@/lib/export/render-pdf";
import { getEntitlements } from "@/lib/entitlements";
import { effectiveTrimSize } from "@/lib/export-config";

const VALID_SECTIONS: SectionId[] = ["characters", "world", "plot", "notes", "research"];
const CONTENT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  epub: "application/epub+zip",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "manuscript"
  );
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  if (!isObjectId(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await connectDB();

  const projectDoc = await Project.findOne({ _id: id, ownerId: userId, deletedAt: null }).lean<Record<string, unknown>>();
  if (!projectDoc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const format = (searchParams.get("format") ?? "docx").toLowerCase();
  if (!(format in CONTENT_TYPES)) {
    return NextResponse.json({ error: "Unsupported format" }, { status: 400 });
  }

  const includeSections = (searchParams.get("sections") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is SectionId => (VALID_SECTIONS as string[]).includes(s));

  const rawSettings = (projectDoc.manuscriptSettings as Partial<ManuscriptSettings>) ?? {};
  const { features } = await getEntitlements(userId);
  const project: SerializedProject = {
    id: String(projectDoc._id),
    title: projectDoc.title as string,
    type: normalizeProjectType(projectDoc.type as string),
    genre: (projectDoc.genre as string) || undefined,
    blurb: (projectDoc.blurb as string) || undefined,
    authorName: (searchParams.get("author")?.trim().slice(0, 120) || (projectDoc.authorName as string)) || undefined,
    chapterNumberingStyle: ((projectDoc.chapterNumberingStyle as string) || "numeral") as SerializedProject["chapterNumberingStyle"],
    chapterNumberingPrefix: (projectDoc.chapterNumberingPrefix as string) || undefined,
    exportTrimSize: effectiveTrimSize(projectDoc.exportTrimSize as string, features.allTrimSizes),
    targetWordCount: (projectDoc.targetWordCount as number) || undefined,
    dailyWordGoal: (projectDoc.dailyWordGoal as number) ?? 300,
    sections: (projectDoc.sections as SectionId[]) ?? [],
    manuscriptSettings: { ...DEFAULT_MANUSCRIPT_SETTINGS, ...rawSettings },
    createdAt: new Date(projectDoc.createdAt as string).toISOString(),
    updatedAt: new Date(projectDoc.updatedAt as string).toISOString(),
  };

  const exportDocument = await buildExportDocument(project, userId, {
    includeTitlePage: searchParams.get("titlePage") !== "off",
    includeTOC: searchParams.get("toc") !== "off",
    dedication: searchParams.get("dedication")?.slice(0, 2000) ?? undefined,
    includeSections,
  });

  let buffer: Buffer;
  try {
    if (format === "pdf") buffer = await renderPdf(exportDocument);
    else if (format === "epub") buffer = await renderEpub(exportDocument);
    else buffer = await renderDocx(exportDocument);
  } catch (error) {
    console.error(`[export] Failed to render ${format} for project ${id}`, error);
    return NextResponse.json({ error: "Failed to generate export" }, { status: 500 });
  }

  const filename = `${slugify(project.title)}.${format}`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": CONTENT_TYPES[format],
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(buffer.length),
    },
  });
}
