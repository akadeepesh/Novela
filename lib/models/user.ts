import { Schema, model, models, type InferSchemaType } from "mongoose";

const billingSchema = new Schema(
  {
    provider: { type: String, enum: ["razorpay", "stripe"], required: true },
    customerId: { type: String },
    subscriptionId: { type: String, index: true },
    // Normalised across providers — see BillingStatus in lib/billing/types.ts.
    status: {
      type: String,
      enum: ["pending", "active", "past_due", "expired"],
      required: true,
    },
    interval: { type: String, enum: ["month", "year"] },
    currency: { type: String, enum: ["INR", "USD"] },
    // Pro lasts until here, even after cancelling (cancelAtPeriodEnd).
    currentPeriodEnd: { type: Date },
    cancelAtPeriodEnd: { type: Boolean, default: false },
    syncedAt: { type: Date },
  },
  { _id: false }
);

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    // Hashed with bcrypt — never store or return plaintext. Absent for
    // accounts created via an OAuth provider (Google), which never set a
    // password on this app.
    passwordHash: { type: String, select: false },
    image: { type: String },
    // Set when we have proof the person controls this email: Google vouched
    // for it, or (later) they clicked a verification link. Absent = never
    // proven, so a password on the account can't be trusted either.
    emailVerified: { type: Date },
    // How this account first signed up — informational, and lets the
    // credentials login give a clearer error to a Google-only account
    // that mistakenly tries a password.
    provider: { type: String, enum: ["credentials", "google"], default: "credentials" },
    // Billing. Written only by lib/billing/state.ts (applySubscriptionState),
    // from verified payment-provider webhooks. Never trust a client for it.
    billing: { type: billingSchema, default: undefined },
    // Bytes of uploaded images (covers, backgrounds) — checked against the
    // plan's storage allowance before each upload.
    storageBytes: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

export type UserDoc = InferSchemaType<typeof userSchema>;

// `models.User` guards against Next.js hot-reload recompiling the model
// and mongoose throwing "OverwriteModelError".
export const User = models.User || model("User", userSchema);
