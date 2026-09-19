import { Schema, model, models, type InferSchemaType } from "mongoose";
import { WORLD_ENTRY_TYPES } from "@/lib/world-config";

const WORLD_ENTRY_TYPE_VALUES = WORLD_ENTRY_TYPES.map((t) => t.value);

const worldEntrySchema = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    type: { type: String, enum: WORLD_ENTRY_TYPE_VALUES, default: "location" },
    // Alternate names this entry might be referred to by in the manuscript —
    // same rationale as Character.aliases, for the future @mention/backlink
    // system (Part 3 continued).
    aliases: { type: [String], default: [] },
    imageUrl: { type: String, trim: true, maxlength: 2000, default: "" },
    description: { type: String, trim: true, maxlength: 4000, default: "" },
    notes: { type: String, trim: true, maxlength: 4000, default: "" },
  },
  { timestamps: true }
);

worldEntrySchema.index({ projectId: 1, name: 1 });

export type WorldEntryDoc = InferSchemaType<typeof worldEntrySchema>;

export const WorldEntry = models.WorldEntry || model("WorldEntry", worldEntrySchema);
