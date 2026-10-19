import "server-only";
import Stripe from "stripe";
import type { BillingInterval, BillingStatus, NormalizedSubscription } from "./types";

let client: Stripe | null = null;

export function stripeConfigured(): boolean {
  return Boolean(
    process.env.STRIPE_SECRET_KEY &&
      process.env.STRIPE_WEBHOOK_SECRET &&
      process.env.STRIPE_PRICE_MONTHLY &&
      process.env.STRIPE_PRICE_YEARLY
  );
}

function stripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY is not set");
  client ??= new Stripe(process.env.STRIPE_SECRET_KEY);
  return client;
}

function priceFor(interval: BillingInterval): string {
  const price = interval === "year" ? process.env.STRIPE_PRICE_YEARLY : process.env.STRIPE_PRICE_MONTHLY;
  if (!price) throw new Error(`Stripe price for ${interval} is not set`);
  return price;
}

/** Starts a hosted Checkout for Pro; returns the URL to send the person to. */
export async function createStripeCheckout(params: {
  userId: string;
  email: string;
  customerId?: string;
  interval: BillingInterval;
  returnUrl: string;
}): Promise<string> {
  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceFor(params.interval), quantity: 1 }],
    ...(params.customerId ? { customer: params.customerId } : { customer_email: params.email }),
    client_reference_id: params.userId,
    // Copied onto the subscription, so every later webhook can be matched to the user.
    subscription_data: { metadata: { userId: params.userId } },
    allow_promotion_codes: true,
    success_url: `${params.returnUrl}?checkout=success`,
    cancel_url: `${params.returnUrl}?checkout=cancelled`,
  });
  if (!session.url) throw new Error("Stripe returned no checkout URL");
  return session.url;
}

/** Stripe's own page for changing card details and viewing invoices. */
export async function createStripePortal(customerId: string, returnUrl: string): Promise<string> {
  const session = await stripe().billingPortal.sessions.create({ customer: customerId, return_url: returnUrl });
  return session.url;
}

export async function setStripeCancelAtPeriodEnd(subscriptionId: string, cancel: boolean) {
  const sub = await stripe().subscriptions.update(subscriptionId, { cancel_at_period_end: cancel });
  return normalizeStripeSubscription(sub);
}

export async function fetchStripeSubscription(subscriptionId: string): Promise<NormalizedSubscription> {
  return normalizeStripeSubscription(await stripe().subscriptions.retrieve(subscriptionId));
}

function mapStatus(status: Stripe.Subscription.Status): BillingStatus {
  switch (status) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "incomplete":
      return "pending";
    default:
      // canceled, incomplete_expired, paused
      return "expired";
  }
}

export function normalizeStripeSubscription(sub: Stripe.Subscription): NormalizedSubscription {
  const item = sub.items.data[0];
  const periodEnd = item?.current_period_end;
  const interval = item?.price.recurring?.interval === "year" ? "year" : "month";
  return {
    provider: "stripe",
    subscriptionId: sub.id,
    customerId: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    userId: sub.metadata?.userId,
    status: mapStatus(sub.status),
    interval,
    currency: "USD",
    currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : undefined,
    cancelAtPeriodEnd: sub.cancel_at_period_end,
  };
}

/**
 * Verifies a webhook delivery and, if it concerns a subscription, returns
 * the subscription's CURRENT state, fetched fresh from Stripe. Throws if
 * the signature is invalid.
 */
export async function readStripeWebhook(
  rawBody: string,
  signature: string
): Promise<{ eventId: string; type: string; subscription: NormalizedSubscription | null }> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not set");
  const event = stripe().webhooks.constructEvent(rawBody, signature, secret);

  let subscriptionId: string | null = null;
  const object = event.data.object as unknown as Record<string, unknown>;
  if (event.type.startsWith("customer.subscription.")) {
    subscriptionId = object.id as string;
  } else if (event.type === "checkout.session.completed") {
    const sub = object.subscription;
    subscriptionId = typeof sub === "string" ? sub : ((sub as { id?: string } | null)?.id ?? null);
  } else if (event.type.startsWith("invoice.")) {
    const parent = object.parent as { subscription_details?: { subscription?: string | { id: string } } } | null;
    const sub = parent?.subscription_details?.subscription ?? (object.subscription as string | undefined);
    subscriptionId = typeof sub === "string" ? sub : (sub?.id ?? null);
  }

  return {
    eventId: event.id,
    type: event.type,
    subscription: subscriptionId ? await fetchStripeSubscription(subscriptionId) : null,
  };
}
