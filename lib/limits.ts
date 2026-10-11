/**
 * Beta usage limits. Storage is paid for, so every account is capped. Limits
 * only ever block CREATING new things: editing, deleting and exporting always
 * keep working, so nobody loses writing because of a quota.
 */
export const LIMITS = {
  projects: 1,
  chapters: 20, // per project
  characters: 10, // per project
  worldEntries: 5, // per project
  plotThreads: 5, // per project
  notes: 20, // per project
  research: 10, // per project
} as const;

export type LimitKind = keyof typeof LIMITS;

const NOUN: Record<LimitKind, string> = {
  projects: "projects",
  chapters: "chapters",
  characters: "characters",
  worldEntries: "world entries",
  plotThreads: "plot threads",
  notes: "notes",
  research: "research entries",
};

/** `noun` overrides the wording, e.g. "poems" for a poetry project. */
export function limitMessage(kind: LimitKind, noun?: string): string {
  const n = LIMITS[kind];
  if (kind === "projects") {
    return `You've reached the beta limit of ${n} projects. Delete one you no longer need to start another.`;
  }
  return `This project has reached the beta limit of ${n} ${noun ?? NOUN[kind]}. Delete one you no longer need to add another.`;
}
