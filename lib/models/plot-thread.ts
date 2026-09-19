import { Schema, model, models, type InferSchemaType } from "mongoose";
import { PLOT_STATUSES } from "@/lib/plot-config";

const PLOT_STATUS_VALUES = PLOT_STATUSES.map((s) => s.value);

const plotThreadSchema = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    status: { type: String, enum: PLOT_STATUS_VALUES, default: "planned" },
    // Alternate names this thread might be referred to by — same rationale
    // as Character.aliases / WorldEntry.aliases, for the future
    // @mention/backlink system (Part 3 continued).
    aliases: { type: [String], default: [] },
    description: { type: String, trim: true, maxlength: 4000, default: "" },
    notes: { type: String, trim: true, maxlength: 4000, default: "" },
  },
  { timestamps: true }
);

plotThreadSchema.index({ projectId: 1, title: 1 });

export type PlotThreadDoc = InferSchemaType<typeof plotThreadSchema>;

export const PlotThread = models.PlotThread || model("PlotThread", plotThreadSchema);
