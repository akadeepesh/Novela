import { readRazorpayWebhook } from "@/lib/billing/razorpay";
import { applySubscriptionState, forgetEvent, recordEventOnce } from "@/lib/billing/state";
import { reportError } from "@/lib/safe-action";

/**
 * Razorpay webhook. The signature is an HMAC of the exact raw body, so it
 * is read as text and only parsed after it has been verified.
 */
export async function POST(request: Request) {
  const signature = request.headers.get("x-razorpay-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });
  const rawBody = await request.text();

  let delivery: Awaited<ReturnType<typeof readRazorpayWebhook>>;
  try {
    delivery = await readRazorpayWebhook(rawBody, signature, request.headers.get("x-razorpay-event-id"));
  } catch (err) {
    // Razorpay unreachable while fetching the subscription: let it retry.
    reportError("razorpay-webhook", err);
    return new Response("Error", { status: 500 });
  }
  if (!delivery) return new Response("Invalid signature", { status: 400 });

  if (!delivery.subscription) return new Response("Ignored", { status: 200 });
  if (!(await recordEventOnce("razorpay", delivery.eventId, delivery.type))) {
    return new Response("Already handled", { status: 200 });
  }

  try {
    const matched = await applySubscriptionState(delivery.subscription);
    if (!matched) reportError("razorpay-webhook", `No user for subscription ${delivery.subscription.subscriptionId}`);
    return new Response("OK", { status: 200 });
  } catch (err) {
    await forgetEvent("razorpay", delivery.eventId);
    reportError("razorpay-webhook", err);
    return new Response("Error", { status: 500 });
  }
}
