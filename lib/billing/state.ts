import "server-only";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import { isObjectId } from "@/lib/object-id";
import { User } from "@/lib/models/user";
import { BillingEvent } from "@/lib/models/billing-event";
import { planFromBilling } from "@/lib/entitlements";
import type { BillingProviderId, BillingState, NormalizedSubscription } from "./types";

/**
 * The ONLY place that writes a user's billing state. Callers pass the
 * subscription as just fetched from the provider (never as described by a
 * client or by a possibly stale webhook body), so applying it is always
 * "make ours match theirs", and the order events arrive in doesn't matter.
 *
 * Returns false if no user could be matched to the subscription.
 */
export async function applySubscriptionState(sub: NormalizedSubscription): Promise<boolean> {
  await connectDB();

  type Existing = { _id: unknown; billing?: BillingState };
  let user = await User.findOne({ "billing.subscriptionId": sub.subscriptionId })
    .select("billing")
    .lean<Existing>();
  if (!user && sub.userId && isObjectId(sub.userId)) {
    user = await User.findById(sub.userId).select("billing").lean<Existing>();
  }
  if (!user) return false;

  // Someone who resubscribed (say after switching currency) has a new
  // subscription. The old one ending later must not take Pro away from them.
  const current = user.billing;
  if (
    current?.subscriptionId &&
    current.subscriptionId !== sub.subscriptionId &&
    planFromBilling(current) === "pro" &&
    planFromBilling(sub) === "free"
  ) {
    return true;
  }

  const billing: BillingState & { syncedAt: Date } = {
    provider: sub.provider,
    customerId: sub.customerId ?? current?.customerId,
    subscriptionId: sub.subscriptionId,
    status: sub.status,
    interval: sub.interval,
    currency: sub.currency,
    currentPeriodEnd: sub.currentPeriodEnd,
    // Razorpay doesn't report a scheduled cancellation (undefined), so keep
    // the one we recorded when the person cancelled, for that same subscription.
    cancelAtPeriodEnd:
      sub.cancelAtPeriodEnd ??
      (current?.subscriptionId === sub.subscriptionId ? (current.cancelAtPeriodEnd ?? false) : false),
    syncedAt: new Date(),
  };
  await User.updateOne({ _id: user._id }, { $set: { billing } });

  // Plan badges, usage meters and limit screens read the plan per request,
  // but cached pages showing them should refresh too.
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return true;
}

/**
 * Records a webhook event id. Returns false if it was already recorded,
 * meaning this delivery is a retry of an event we've handled.
 */
export async function recordEventOnce(
  provider: BillingProviderId,
  eventId: string,
  type: string
): Promise<boolean> {
  await connectDB();
  try {
    await BillingEvent.create({ provider, eventId, type });
    return true;
  } catch (err) {
    if ((err as { code?: number }).code === 11000) return false;
    throw err;
  }
}

/** Forgets an event whose handling failed, so the provider's retry is processed. */
export async function forgetEvent(provider: BillingProviderId, eventId: string): Promise<void> {
  await BillingEvent.deleteOne({ provider, eventId });
}
