"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { User } from "@/lib/models/user";
import { requireUserId } from "@/lib/projects";
import { getEntitlements } from "@/lib/entitlements";
import { safeAction } from "@/lib/safe-action";
import { applySubscriptionState } from "@/lib/billing/state";
import { providerForCurrency } from "@/lib/billing/types";
import {
  createStripeCheckout,
  createStripePortal,
  setStripeCancelAtPeriodEnd,
  stripeConfigured,
} from "@/lib/billing/stripe";
import {
  cancelRazorpayAtCycleEnd,
  createRazorpaySubscription,
  fetchRazorpaySubscription,
  razorpayConfigured,
  verifyRazorpayCheckout,
} from "@/lib/billing/razorpay";

const UNAVAILABLE = "Payments aren't available right now. Please try again later.";

async function appUrl(path: string): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return new URL(path, configured).toString();
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}${path}`;
}

const checkoutSchema = z.object({
  currency: z.enum(["INR", "USD"]),
  interval: z.enum(["month", "year"]),
});

export type CheckoutResult =
  | { ok: true; kind: "redirect"; url: string }
  | { ok: true; kind: "razorpay"; keyId: string; subscriptionId: string; name: string; email: string }
  | { ok: false; error: string };

/** Starts paying for Pro: a Stripe Checkout URL, or what Razorpay Checkout needs to open. */
export const startCheckoutAction = safeAction(
  "startCheckoutAction",
  async (input: { currency: string; interval: string }): Promise<CheckoutResult> => {
    const userId = await requireUserId();
    const parsed = checkoutSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Choose a plan first." };
    const { currency, interval } = parsed.data;

    const { plan, billing } = await getEntitlements(userId);
    if (plan === "pro") return { ok: false, error: "You're already on Pro." };

    await connectDB();
    const user = await User.findById(userId).select("name email").lean<{ name: string; email: string }>();
    if (!user) return { ok: false, error: "Couldn't find your account." };

    if (providerForCurrency(currency) === "stripe") {
      if (!stripeConfigured()) return { ok: false, error: UNAVAILABLE };
      const url = await createStripeCheckout({
        userId,
        email: user.email,
        customerId: billing?.provider === "stripe" ? billing.customerId : undefined,
        interval,
        returnUrl: await appUrl("/settings"),
      });
      return { ok: true, kind: "redirect", url };
    }

    if (!razorpayConfigured()) return { ok: false, error: UNAVAILABLE };
    const { subscriptionId, keyId } = await createRazorpaySubscription({ userId, interval });
    return { ok: true, kind: "razorpay", keyId, subscriptionId, name: user.name, email: user.email };
  },
  () => ({ ok: false as const, error: "Couldn't start checkout. Please try again." })
);

const razorpayConfirmSchema = z.object({
  paymentId: z.string().min(1).max(100),
  subscriptionId: z.string().min(1).max(100),
  signature: z.string().min(1).max(200),
});

/**
 * Called by the browser right after Razorpay Checkout succeeds, so Pro
 * applies immediately instead of waiting for the webhook (which still
 * arrives and is harmless to apply again).
 */
export const confirmRazorpayCheckoutAction = safeAction(
  "confirmRazorpayCheckoutAction",
  async (input: { paymentId: string; subscriptionId: string; signature: string }): Promise<{ ok: boolean }> => {
    const userId = await requireUserId();
    const parsed = razorpayConfirmSchema.safeParse(input);
    if (!parsed.success || !verifyRazorpayCheckout(parsed.data)) return { ok: false };

    const sub = await fetchRazorpaySubscription(parsed.data.subscriptionId);
    // The subscription must be one this person started.
    if (sub.userId !== userId) return { ok: false };
    return { ok: await applySubscriptionState(sub) };
  },
  () => ({ ok: false })
);

export type BillingActionResult = { ok: true } | { ok: false; error: string };

/** Cancels at the end of the paid period. Pro (and everything written) stays until then. */
export const cancelSubscriptionAction = safeAction(
  "cancelSubscriptionAction",
  async (): Promise<BillingActionResult> => {
    const userId = await requireUserId();
    const { billing } = await getEntitlements(userId);
    if (!billing?.subscriptionId || billing.status === "expired") {
      return { ok: false, error: "There's no active subscription to cancel." };
    }
    const sub =
      billing.provider === "stripe"
        ? await setStripeCancelAtPeriodEnd(billing.subscriptionId, true)
        : await cancelRazorpayAtCycleEnd(billing.subscriptionId);
    await applySubscriptionState(sub);
    return { ok: true };
  },
  () => ({ ok: false as const, error: "Couldn't cancel just now. Please try again." })
);

/** Undoes a scheduled cancellation (Stripe only; Razorpay can't un-cancel). */
export const resumeSubscriptionAction = safeAction(
  "resumeSubscriptionAction",
  async (): Promise<BillingActionResult> => {
    const userId = await requireUserId();
    const { billing } = await getEntitlements(userId);
    if (billing?.provider !== "stripe" || !billing.subscriptionId) {
      return { ok: false, error: "This subscription can't be resumed. You can subscribe again when it ends." };
    }
    await applySubscriptionState(await setStripeCancelAtPeriodEnd(billing.subscriptionId, false));
    return { ok: true };
  },
  () => ({ ok: false as const, error: "Couldn't resume just now. Please try again." })
);

/** Stripe's page for updating the card and downloading invoices. */
export const openBillingPortalAction = safeAction(
  "openBillingPortalAction",
  async (): Promise<{ ok: true; url: string } | { ok: false; error: string }> => {
    const userId = await requireUserId();
    const { billing } = await getEntitlements(userId);
    if (billing?.provider !== "stripe" || !billing.customerId) {
      return { ok: false, error: "Card details are managed from your Razorpay emails." };
    }
    return { ok: true, url: await createStripePortal(billing.customerId, await appUrl("/settings")) };
  },
  () => ({ ok: false as const, error: "Couldn't open billing just now. Please try again." })
);
