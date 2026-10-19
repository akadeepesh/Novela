import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import Razorpay from "razorpay";
import type { Subscriptions } from "razorpay/dist/types/subscriptions";
import type { BillingInterval, BillingStatus, NormalizedSubscription } from "./types";

type RazorpaySubscription = Subscriptions.RazorpaySubscription;

let client: Razorpay | null = null;

export function razorpayConfigured(): boolean {
  return Boolean(
    process.env.RAZORPAY_KEY_ID &&
      process.env.RAZORPAY_KEY_SECRET &&
      process.env.RAZORPAY_WEBHOOK_SECRET &&
      process.env.RAZORPAY_PLAN_MONTHLY &&
      process.env.RAZORPAY_PLAN_YEARLY
  );
}

function razorpay(): Razorpay {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) throw new Error("Razorpay keys are not set");
  client ??= new Razorpay({ key_id, key_secret });
  return client;
}

function planFor(interval: BillingInterval): string {
  const plan = interval === "year" ? process.env.RAZORPAY_PLAN_YEARLY : process.env.RAZORPAY_PLAN_MONTHLY;
  if (!plan) throw new Error(`Razorpay plan for ${interval} is not set`);
  return plan;
}

/** Constant-time comparison of a hex HMAC-SHA256 signature. */
function signatureMatches(message: string, signature: string, secret: string): boolean {
  const expected = createHmac("sha256", secret).update(message).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Creates a subscription for Razorpay Checkout to collect the first payment
 * on (card, UPI Autopay, netbanking…). Returns what the client needs to
 * open Checkout.
 */
export async function createRazorpaySubscription(params: {
  userId: string;
  interval: BillingInterval;
}): Promise<{ subscriptionId: string; keyId: string }> {
  const sub = await razorpay().subscriptions.create({
    plan_id: planFor(params.interval),
    // Razorpay needs a finite number of billing cycles: ~10 years either way.
    total_count: params.interval === "year" ? 10 : 120,
    customer_notify: 1,
    notes: { userId: params.userId },
  });
  return { subscriptionId: sub.id, keyId: process.env.RAZORPAY_KEY_ID! };
}

/**
 * Checks the signature Razorpay Checkout hands the browser after payment,
 * proving the payment really was for this subscription.
 */
export function verifyRazorpayCheckout(params: {
  paymentId: string;
  subscriptionId: string;
  signature: string;
}): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) return false;
  return signatureMatches(`${params.paymentId}|${params.subscriptionId}`, params.signature, secret);
}

/** Cancels at the end of the paid cycle: Pro continues until then. */
export async function cancelRazorpayAtCycleEnd(subscriptionId: string): Promise<NormalizedSubscription> {
  const sub = await razorpay().subscriptions.cancel(subscriptionId, true);
  return { ...normalizeRazorpaySubscription(sub), cancelAtPeriodEnd: true };
}

export async function fetchRazorpaySubscription(subscriptionId: string): Promise<NormalizedSubscription> {
  return normalizeRazorpaySubscription(await razorpay().subscriptions.fetch(subscriptionId));
}

function mapStatus(status: RazorpaySubscription["status"]): BillingStatus {
  switch (status) {
    case "active":
      return "active";
    case "pending":
      // A renewal charge failed; Razorpay is retrying it.
      return "past_due";
    case "created":
    case "authenticated":
      return "pending";
    default:
      // halted (retries exhausted), cancelled, completed, expired
      return "expired";
  }
}

export function normalizeRazorpaySubscription(sub: RazorpaySubscription): NormalizedSubscription {
  const notes = (sub.notes ?? {}) as Record<string, string | number>;
  return {
    provider: "razorpay",
    subscriptionId: sub.id,
    customerId: (sub as { customer_id?: string | null }).customer_id ?? undefined,
    userId: notes.userId ? String(notes.userId) : undefined,
    status: mapStatus(sub.status),
    interval: sub.plan_id === process.env.RAZORPAY_PLAN_YEARLY ? "year" : "month",
    currency: "INR",
    currentPeriodEnd: sub.current_end ? new Date(sub.current_end * 1000) : undefined,
    // Razorpay doesn't report a scheduled cancellation; see applySubscriptionState.
    cancelAtPeriodEnd: undefined,
  };
}

/**
 * Verifies a webhook delivery and, if it concerns a subscription, returns
 * its CURRENT state, fetched fresh from Razorpay. Returns null when the
 * signature is invalid.
 */
export async function readRazorpayWebhook(
  rawBody: string,
  signature: string,
  eventIdHeader: string | null
): Promise<{ eventId: string; type: string; subscription: NormalizedSubscription | null } | null> {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) throw new Error("RAZORPAY_WEBHOOK_SECRET is not set");
  if (!signatureMatches(rawBody, signature, secret)) return null;

  const body = JSON.parse(rawBody) as {
    event: string;
    created_at?: number;
    payload?: { subscription?: { entity?: { id?: string } } };
  };
  const subscriptionId = body.payload?.subscription?.entity?.id;
  return {
    // Razorpay sends a unique id per event in this header.
    eventId: eventIdHeader ?? `${body.event}:${subscriptionId}:${body.created_at}`,
    type: body.event,
    subscription: subscriptionId ? await fetchRazorpaySubscription(subscriptionId) : null,
  };
}
