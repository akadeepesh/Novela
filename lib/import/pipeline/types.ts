/**
 * Shared (client + server) shapes for the import pipeline and its progress
 * screen. No server-only imports: the progress screen renders from these.
 */
import type { ProjectType } from "@/lib/project-config";
import type { BackgroundMethod, BackgroundQuality } from "@/lib/import/background/types";

export const STAGE_ORDER = ["text", "structure", "format", "background", "cover"] as const;
export type StageId = (typeof STAGE_ORDER)[number];

export type StageStatus = "pending" | "active" | "done" | "skipped";

export type StageState = {
  status: StageStatus;
  /** 0–1, real progress within the stage (only meaningful while active). */
  fraction: number;
  /** One live sentence about what is happening right now. */
  detail: string;
  /** What the stage found, in plain words — shown once it's done. */
  facts: string[];
};

export type RunPhase = "running" | "done" | "failed";

export type RunState = {
  phase: RunPhase;
  stages: Record<StageId, StageState>;
  startedAt: number;
  /** Heartbeat — a run that stops updating is treated as interrupted. */
  updatedAt: number;
  finishedAt?: number;
  error?: { message: string; stage?: StageId };
};

export type ImportSummary = {
  pages: number;
  words: number;
  pieces: number;
  /** Pieces whose boundaries are anything less than high-confidence — where the review screen points first. */
  needsLook: number;
  rejoinedWraps: number;
  background: { method: BackgroundMethod; quality: BackgroundQuality; recommendation: "use-image" | "use-flat-color"; flatColor: string } | null;
  hasCover: boolean;
  seconds: number;
};

/** A run that hasn't reported in this long is assumed to have been cut off (server restart, timeout). */
export const RUN_STALE_AFTER_MS = 120_000;

export function emptyStage(): StageState {
  return { status: "pending", fraction: 0, detail: "", facts: [] };
}

export function freshRun(hasCover: boolean): RunState {
  const now = Date.now();
  const stages = Object.fromEntries(STAGE_ORDER.map((id) => [id, emptyStage()])) as Record<StageId, StageState>;
  if (!hasCover) stages.cover = { status: "skipped", fraction: 1, detail: "", facts: ["No cover in the PDF — you’ll get a typeset one until you add your own."] };
  return { phase: "running", stages, startedAt: now, updatedAt: now };
}

const NOUNS: Record<ProjectType, [string, string]> = {
  novel: ["chapter", "chapters"],
  poetry: ["poem", "poems"],
  "script-writing": ["script", "scripts"],
  custom: ["piece", "pieces"],
};

export function pieceNoun(type: ProjectType, count: number): string {
  return NOUNS[type][count === 1 ? 0 : 1];
}

export type ImportAssets = {
  background: boolean;
  cover: boolean;
};
