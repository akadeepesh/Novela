import { Schema, model, models } from "mongoose";

/**
 * Webhook events already handled. Providers deliver at least once and retry
 * on any error, so the same event can arrive several times; recording its id
 * first makes handling it a second time a no-op.
 */
const billingEventSchema = new Schema(
  {
    provider: { type: String, enum: ["razorpay", "stripe"], required: true },
    eventId: { type: String, required: true },
    type: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

billingEventSchema.index({ provider: 1, eventId: 1 }, { unique: true });
// Ids only need remembering for as long as a provider keeps retrying.
billingEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

export const BillingEvent = models.BillingEvent || model("BillingEvent", billingEventSchema);
