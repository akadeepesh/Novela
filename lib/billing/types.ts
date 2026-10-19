export type BillingProviderId = "razorpay" | "stripe";
export type BillingInterval = "month" | "year";
export type Currency = "INR" | "USD";

/**
 * One status vocabulary for both providers:
 *  - pending: checkout started, first payment not confirmed yet
 *  - active: paid for the current period (it may be set to cancel at its end)
 *  - past_due: a renewal failed and the provider is retrying it
 *  - expired: over — cancelled, ended, or retries ran out
 */
export type BillingStatus = "pending" | "active" | "past_due" | "expired";

export type BillingState = {
  provider: BillingProviderId;
  customerId?: string;
  subscriptionId?: string;
  status: BillingStatus;
  interval?: BillingInterval;
  currency?: Currency;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd?: boolean;
};

/** A subscription as read from a provider, in our vocabulary. */
export type NormalizedSubscription = BillingState & {
  subscriptionId: string;
  /** Our user id, from the metadata/notes we attach at checkout. */
  userId?: string;
};

/** Which provider and currency someone pays with, by country. */
export function providerForCurrency(currency: Currency): BillingProviderId {
  return currency === "INR" ? "razorpay" : "stripe";
}
