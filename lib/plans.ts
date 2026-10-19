/**
 * Plans and what each one allows. Shared by server and client (pricing
 * page, limit messages), so nothing here touches the database — see
 * lib/entitlements.ts for looking up a person's plan.
 *
 * Limits only ever block CREATING new things: editing, deleting and
 * exporting always keep working, on every plan and after a downgrade, so
 * nobody loses access to their writing because of a quota.
 */

export const PLAN_IDS = ["free", "pro"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export type LimitKind =
  | "projects"
  | "chapters"
  | "characters"
  | "worldEntries"
  | "plotThreads"
  | "notes"
  | "research";

export type PlanFeatures = {
  /** Count limits. `projects` is per account; the rest are per project. */
  limits: Record<LimitKind, number>;
  /** Uploaded images (covers, backgrounds), in bytes. */
  storageBytes: number;
  /** Automatic snapshots kept per chapter (newest first; never pruned by age). */
  autoVersions: number;
  /** Manual "Save version" snapshots kept per chapter (null = no limit). */
  manualVersions: number | null;
  /** Active beta-reader share links per project. */
  shareLinks: number;
  /** Readers can leave comments on a share link; links can have a password/expiry. */
  readerComments: boolean;
  /** Every PDF trim size (Free: 6×9 and US Letter). Exports never carry a watermark on any plan. */
  allTrimSizes: boolean;
};

const MB = 1024 * 1024;

export const PLANS: Record<PlanId, { name: string; features: PlanFeatures }> = {
  free: {
    name: "Free",
    features: {
      limits: {
        projects: 2,
        chapters: 40,
        characters: 15,
        worldEntries: 10,
        plotThreads: 10,
        notes: 30,
        research: 20,
      },
      storageBytes: 25 * MB,
      autoVersions: 20,
      manualVersions: 10,
      shareLinks: 1,
      readerComments: false,
      allTrimSizes: false,
    },
  },
  pro: {
    name: "Pro",
    features: {
      // "Unlimited" in practice; the numbers only stop runaway scripts.
      limits: {
        projects: 100,
        chapters: 500,
        characters: 500,
        worldEntries: 500,
        plotThreads: 500,
        notes: 500,
        research: 500,
      },
      storageBytes: 2048 * MB,
      autoVersions: 200,
      manualVersions: null,
      shareLinks: 50,
      readerComments: true,
      allTrimSizes: true,
    },
  },
};

/** Pro prices shown on the pricing page. Charged amounts live in each provider's plan/price. */
export const PRO_PRICES = {
  INR: { month: 249, year: 2399, symbol: "₹" },
  USD: { month: 5, year: 48, symbol: "$" },
} as const;

export function isPlanId(value: unknown): value is PlanId {
  return typeof value === "string" && (PLAN_IDS as readonly string[]).includes(value);
}

const NOUN: Record<LimitKind, [singular: string, plural: string]> = {
  projects: ["project", "projects"],
  chapters: ["chapter", "chapters"],
  characters: ["character", "characters"],
  worldEntries: ["world entry", "world entries"],
  plotThreads: ["plot thread", "plot threads"],
  notes: ["note", "notes"],
  research: ["research entry", "research entries"],
};

/**
 * The message shown when a limit is reached. `noun` overrides the plural
 * wording, e.g. "poems" for a poetry project.
 */
export function limitMessage(kind: LimitKind, plan: PlanId, noun?: string): string {
  const n = PLANS[plan].features.limits[kind];
  const [singular, plural] = NOUN[kind];
  const what = n === 1 ? singular : (noun ?? plural);
  const upgrade = plan === "free" ? " Upgrade to Pro for more, or delete" : " Delete";
  if (kind === "projects") {
    return `You've reached the ${PLANS[plan].name} plan limit of ${n} active ${what}.${upgrade} one you no longer need (it goes to the Trash).`;
  }
  return `This project has reached the ${PLANS[plan].name} plan limit of ${n} ${what}.${upgrade} one you no longer need.`;
}
