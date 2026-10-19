import "server-only";
import { cache } from "react";
import type { Model, Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { User } from "@/lib/models/user";
import { PLANS, type LimitKind, type PlanFeatures, type PlanId } from "@/lib/plans";
import type { BillingState } from "@/lib/billing/types";

// A failed renewal keeps Pro this long past the period end while the
// provider retries the payment, so a card hiccup doesn't interrupt anyone.
const PAST_DUE_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Which plan a billing state grants right now. Pro while the paid period
 * runs, including after choosing to cancel (until the period ends), and
 * briefly while a failed renewal is being retried.
 */
export function planFromBilling(billing: BillingState | null | undefined, now = Date.now()): PlanId {
  if (!billing?.currentPeriodEnd) return "free";
  const end = new Date(billing.currentPeriodEnd).getTime();
  switch (billing.status) {
    case "active":
      return now < end ? "pro" : "free";
    case "past_due":
      return now < end + PAST_DUE_GRACE_MS ? "pro" : "free";
    default:
      return "free";
  }
}

export type Entitlements = {
  plan: PlanId;
  features: PlanFeatures;
  billing: BillingState | null;
  storageBytesUsed: number;
};

/**
 * The person's plan, read from the database (not the session token) so an
 * upgrade applies on the very next request. Cached per request.
 */
export const getEntitlements = cache(async (userId: string): Promise<Entitlements> => {
  await connectDB();
  const user = await User.findById(userId)
    .select("billing storageBytes")
    .lean<{ billing?: BillingState; storageBytes?: number }>();
  const plan = planFromBilling(user?.billing);
  return {
    plan,
    features: PLANS[plan].features,
    billing: user?.billing ?? null,
    storageBytesUsed: user?.storageBytes ?? 0,
  };
});

export async function getLimit(userId: string, kind: LimitKind): Promise<{ plan: PlanId; limit: number }> {
  const { plan, features } = await getEntitlements(userId);
  return { plan, limit: features.limits[kind] };
}

/**
 * Closes the gap between "count, then create": two requests can both see
 * room for one more and both create. Call right after creating; it counts
 * the matching documents up to and including the new one (ObjectIds sort
 * by creation time) and, if that is over the limit, deletes the new one.
 * The earlier request keeps its document; the later one reports the limit.
 */
export async function keepWithinLimit(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: Model<any>,
  filter: Record<string, unknown>,
  createdId: Types.ObjectId | string,
  limit: number
): Promise<boolean> {
  const count = await model.countDocuments({ ...filter, _id: { $lte: createdId } });
  if (count <= limit) return true;
  await model.deleteOne({ _id: createdId });
  return false;
}
