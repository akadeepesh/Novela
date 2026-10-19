import { readStripeWebhook } from "@/lib/billing/stripe";
import { applySubscriptionState, forgetEvent, recordEventOnce } from "@/lib/billing/state";
import { reportError } from "@/lib/safe-action";

/**
 * Stripe webhook. The signature is checked against the exact raw body, so
 * it is read as text and never parsed before verification.
 */
export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });
  const rawBody = await request.text();

  let delivery: Awaited<ReturnType<typeof readStripeWebhook>>;
  try {
    delivery = await readStripeWebhook(rawBody, signature);
  } catch (err) {
    // Bad signature (or Stripe unreachable while fetching the subscription):
    // a non-2xx makes Stripe retry later.
    reportError("stripe-webhook", err);
    return new Response("Invalid webhook", { status: 400 });
  }

  if (!delivery.subscription) return new Response("Ignored", { status: 200 });
  if (!(await recordEventOnce("stripe", delivery.eventId, delivery.type))) {
    return new Response("Already handled", { status: 200 });
  }

  try {
    const matched = await applySubscriptionState(delivery.subscription);
    if (!matched) reportError("stripe-webhook", `No user for subscription ${delivery.subscription.subscriptionId}`);
    return new Response("OK", { status: 200 });
  } catch (err) {
    await forgetEvent("stripe", delivery.eventId);
    reportError("stripe-webhook", err);
    return new Response("Error", { status: 500 });
  }
}
