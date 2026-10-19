import { Schema, model, models } from "mongoose";

/** Counters for fixed time windows; MongoDB removes each once its window has passed. */
const rateLimitSchema = new Schema({
  key: { type: String, required: true, unique: true },
  count: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true },
});

rateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RateLimit = models.RateLimit || model("RateLimit", rateLimitSchema);
