import { Schema, model, models, type InferSchemaType } from "mongoose";

const dailyStatSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    // YYYY-MM-DD (UTC) — a simple string key rather than a Date, since we
    // only ever query/compare by calendar day, not by time of day.
    date: { type: String, required: true },
    // Total word count across the project's chapters as of the last save
    // recorded that day — a running snapshot, not a delta.
    totalWordCount: { type: Number, default: 0 },
    // Derived at write time as max(0, today's total - the most recent
    // prior day's total). Floored at 0 so deleting text never shows as
    // "negative words written."
    wordsWritten: { type: Number, default: 0 },
  },
  { timestamps: true }
);

dailyStatSchema.index({ projectId: 1, date: 1 }, { unique: true });
dailyStatSchema.index({ ownerId: 1, date: 1 });

export type DailyStatDoc = InferSchemaType<typeof dailyStatSchema>;

export const DailyStat = models.DailyStat || model("DailyStat", dailyStatSchema);
