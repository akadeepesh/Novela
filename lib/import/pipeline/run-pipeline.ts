import "server-only";
import { connectDB } from "@/lib/db";
import { ImportJob } from "@/lib/models/import-job";
import { CHAPTER_LABEL_SINGULAR, normalizeProjectType } from "@/lib/project-config";
import { readImportBlob } from "@/lib/import/storage";
import { extractText } from "@/lib/import/extract/extract-text";
import { detectStructure } from "@/lib/import/structure/detect-structure";
import { formatBook } from "@/lib/import/format/build-format";
import { extractBackground } from "@/lib/import/background/extract-background";
import { recurringFurnitureBoxes } from "@/lib/import/background/furniture-boxes";
import { extractCover } from "@/lib/import/cover/extract-cover";
import { importFilePath, putImportFile } from "./store";
import {
  freshRun,
  pieceNoun,
  type ImportSummary,
  type RunState,
  type StageId,
} from "./types";

const FLUSH_EVERY_MS = 350;

class JobGone extends Error {}
class StageFailure extends Error {
  constructor(
    message: string,
    readonly stage: StageId
  ) {
    super(message);
  }
}

/** While developing, show the actual reason on screen too — in production the person only needs the plain sentence. */
const devReason = (err: unknown): string[] =>
  process.env.NODE_ENV === "production" ? [] : [`(dev) ${err instanceof Error ? `${err.name}: ${err.message}` : String(err)}`.slice(0, 220)];

const plural = (n: number, one: string, many: string) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;

/**
 * Writes progress to the job record where the progress screen polls it.
 * Frequent fraction updates are throttled; a change of stage always lands
 * immediately. If the job has been deleted (the person cancelled), the next
 * write throws JobGone and the pipeline stops.
 */
class Reporter {
  private lastFlush = 0;
  constructor(
    private readonly jobId: string,
    private readonly userId: string,
    readonly state: RunState
  ) {}

  async flush(force = false, extra: Record<string, unknown> = {}) {
    const now = Date.now();
    if (!force && now - this.lastFlush < FLUSH_EVERY_MS) return;
    this.lastFlush = now;
    this.state.updatedAt = now;
    const res = await ImportJob.updateOne(
      { _id: this.jobId, ownerId: this.userId },
      { $set: { run: this.state, ...extra } }
    );
    if (res.matchedCount === 0) throw new JobGone();
  }

  async begin(stage: StageId, detail: string) {
    const s = this.state.stages[stage];
    s.status = "active";
    s.fraction = 0;
    s.detail = detail;
    await this.flush(true);
  }

  async progress(stage: StageId, fraction: number, detail?: string) {
    const s = this.state.stages[stage];
    s.fraction = Math.max(s.fraction, Math.min(1, fraction));
    if (detail) s.detail = detail;
    await this.flush(false);
  }

  async finish(stage: StageId, facts: string[], status: "done" | "skipped" = "done", extra: Record<string, unknown> = {}) {
    const s = this.state.stages[stage];
    s.status = status;
    s.fraction = 1;
    s.detail = "";
    s.facts = facts;
    await this.flush(true, extra);
  }
}

/**
 * Steps 3–7 end to end, for one job: reads the text, finds the pieces, sets
 * their formatting, lifts the background and (if there is one) the cover —
 * reporting real progress as it goes and saving everything the review screen
 * needs. The text stages are fatal if they fail. The background and the cover
 * are not: losing them degrades the result (a flat colour, a typeset cover)
 * but never the manuscript, so they fail soft with a plain explanation.
 */
export async function runImportPipeline(jobId: string, userId: string): Promise<void> {
  await connectDB();
  const job = await ImportJob.findOne({ _id: jobId, ownerId: userId }).lean<Record<string, unknown>>();
  if (!job) return;

  const projectType = normalizeProjectType((job.projectType as string) ?? "custom");
  const hasFrontCover = job.hasFrontCover === true;
  const fileName = (job.fileName as string) ?? "";
  const reporter = new Reporter(jobId, userId, freshRun(hasFrontCover));
  const started = Date.now();
  let current: StageId = "text";

  try {
    await reporter.flush(true);

    const read = await readImportBlob(job.sourcePathname as string);
    if (!read.ok) throw new StageFailure("The uploaded PDF is no longer available — upload it again to start over.", "text");
    const bytes = read.bytes;
    // pdf.js takes ownership of any buffer it opens, so every stage works on its own copy.

    // ── 1 · the text ───────────────────────────────────────────────────────
    current = "text";
    await reporter.begin("text", "Reading every line, with its font and where it sits on the page");
    const extracted = await extractText(bytes.slice());
    const lineCount = extracted.pages.reduce((n, p) => n + p.lines.length, 0);
    await reporter.finish("text", [
      `${plural(extracted.pages.length, "page", "pages")} read`,
      `${plural(lineCount, "line", "lines")} of text`,
    ]);

    // ── 2 · where each piece begins and ends ───────────────────────────────
    current = "structure";
    await reporter.begin("structure", "Looking for what separates one piece from the next");
    const structure = detectStructure(extracted, {
      projectType,
      hasFrontCover,
      fallbackTitle: fileName.replace(/\.pdf$/i, ""),
      bareNumberLabel: CHAPTER_LABEL_SINGULAR[projectType],
    });
    const needsLook = structure.pieces.filter((p) => p.confidence !== "high").length;
    await reporter.finish("structure", [
      `${plural(structure.pieces.length, pieceNoun(projectType, 1), pieceNoun(projectType, 2))} found`,
      needsLook === 0 ? "Every boundary looks certain" : `${plural(needsLook, "boundary is", "boundaries are")} worth a second look`,
    ]);

    // ── 3 · the formatting ─────────────────────────────────────────────────
    current = "format";
    await reporter.begin("format", "Putting lines, stanzas and paragraphs back the way you set them");
    const formatted = formatBook(extracted, structure);
    await reporter.finish("format", [
      `${plural(formatted.totals.words, "word", "words")} in place`,
      formatted.totals.rejoinedWraps > 0
        ? `${plural(formatted.totals.rejoinedWraps, "broken line", "broken lines")} mended`
        : "No broken lines to mend",
    ]);

    // Save what review will need, before the slow stage — if that stage is cut off, the text work isn't lost.
    const textPathname = importFilePath(userId, jobId, "text.json");
    const resultPathname = importFilePath(userId, jobId, "result.json");
    await putImportFile(textPathname, JSON.stringify(extracted), "application/json");
    await putImportFile(resultPathname, JSON.stringify({ structure, formatted }), "application/json");
    await ImportJob.updateOne({ _id: jobId, ownerId: userId }, { $set: { "assets.textPathname": textPathname, "assets.resultPathname": resultPathname } });

    // ── 4 · the background ─────────────────────────────────────────────────
    current = "background";
    let background: ImportSummary["background"] = null;
    await reporter.begin("background", "Checking how the pages are decorated");
    try {
      const result = await extractBackground(bytes.slice(), {
        hasFrontCover,
        recurringMarks: recurringFurnitureBoxes(extracted, structure),
        onProgress: (p) => {
          // The renderer reports sync; progress writes are best-effort, so a failed one never stops the extraction.
          const send = (f: number, d: string) => void reporter.progress("background", f, d).catch(() => {});
          switch (p.stage) {
            case "checking": return send(0.03, "Checking how the pages are decorated");
            case "rendering": return send(0.05 + 0.65 * (p.done / Math.max(1, p.total)), `Looking at page ${Math.min(p.done + 1, p.total)} of ${p.total}`);
            case "stacking": return send(0.7 + 0.25 * p.fraction, "Laying the pages over one another");
            case "cleaning": return send(0.96, "Painting over the page numbers");
            case "encoding": return send(0.98, "Saving the picture");
          }
        },
      });

      let backgroundExtra: Record<string, unknown> = {};
      if (result.image) {
        const ext = result.image.mime === "image/png" ? "png" : "jpg";
        const pathname = importFilePath(userId, jobId, `background.${ext}`);
        await putImportFile(pathname, result.image.bytes, result.image.mime);
        backgroundExtra = { "assets.backgroundPathname": pathname, "assets.backgroundMime": result.image.mime };
      }
      await putImportFile(importFilePath(userId, jobId, "background.json"), JSON.stringify({ ...result, image: result.image ? { ...result.image, bytes: undefined } : null }), "application/json");
      background = { method: result.method, quality: result.quality, recommendation: result.recommendation, flatColor: result.flatColor.hex };

      const facts =
        result.method === "embedded-image"
          ? ["Took the picture that’s already in the file"]
          : result.method === "flat-color"
            ? ["Plain-coloured pages — nothing to lift"]
            : [`Compared ${plural(result.samples.pages.length, "page", "pages")}; the writing washed away, the design stayed`];
      if (result.quality === "poor") facts.push("Not clean enough to trust — a plain colour is suggested");
      else if (result.quality === "fair") facts.push("Usable, but worth a look");
      await reporter.finish("background", facts, "done", backgroundExtra);
    } catch (err) {
      if (err instanceof JobGone) throw err;
      console.error("import pipeline: background failed", err);
      await reporter.finish("background", ["Couldn’t lift the background — you’ll be able to pick a colour instead", ...devReason(err)], "skipped");
    }

    // ── 5 · the cover ──────────────────────────────────────────────────────
    current = "cover";
    let hasCover = false;
    if (hasFrontCover) {
      await reporter.begin("cover", "Drawing page 1 as your front cover");
      try {
        const cover = await extractCover(bytes.slice());
        const ext = cover.image.mime === "image/png" ? "png" : "jpg";
        const pathname = importFilePath(userId, jobId, `cover.${ext}`);
        await putImportFile(pathname, cover.image.bytes, cover.image.mime);
        hasCover = true;
        await reporter.finish("cover", ["Page 1 is now your front cover"], "done", {
          "assets.coverPathname": pathname,
          "assets.coverMime": cover.image.mime,
        });
      } catch (err) {
        if (err instanceof JobGone) throw err;
        console.error("import pipeline: cover failed", err);
        await reporter.finish("cover", ["Couldn’t draw the cover — you’ll get a typeset one, or can upload your own", ...devReason(err)], "skipped");
      }
    }

    // ── done ───────────────────────────────────────────────────────────────
    const summary: ImportSummary = {
      pages: extracted.pages.length,
      words: formatted.totals.words,
      pieces: structure.pieces.length,
      needsLook,
      rejoinedWraps: formatted.totals.rejoinedWraps,
      background,
      hasCover,
      seconds: Math.round((Date.now() - started) / 1000),
    };
    reporter.state.phase = "done";
    reporter.state.finishedAt = Date.now();
    await reporter.flush(true, { status: "processed", summary });
  } catch (err) {
    if (err instanceof JobGone) return; // cancelled — nothing left to report to
    console.error("import pipeline failed", err);
    const failedStage = err instanceof StageFailure ? err.stage : current;
    reporter.state.phase = "failed";
    reporter.state.finishedAt = Date.now();
    reporter.state.error = {
      stage: failedStage,
      message: err instanceof StageFailure ? err.message : "Something went wrong while reading your book. Nothing was saved — you can try again.",
    };
    try {
      await reporter.flush(true);
    } catch {
      /* the job is gone too */
    }
  }
}
