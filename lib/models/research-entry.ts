import { Schema, model, models, type InferSchemaType } from "mongoose";
import { RESEARCH_ENTRY_TYPES } from "@/lib/research-config";

const RESEARCH_ENTRY_TYPE_VALUES = RESEARCH_ENTRY_TYPES.map((t) => t.value);

const researchEntrySchema = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    type: { type: String, enum: RESEARCH_ENTRY_TYPE_VALUES, default: "note" },
    // The source URL for a link, or the image address for an image entry.
    // Unused for a plain note.
    url: { type: String, trim: true, maxlength: 2000, default: "" },
    // The note body for a "note" entry, or a caption/why-this-matters for
    // a "link"/"image" entry.
    content: { type: String, trim: true, maxlength: 8000, default: "" },
    // Auto-fetched preview metadata for a "link" entry (Part 7.2's source
    // board) — captured once when the URL is pasted in, not re-fetched on
    // every render. Unused for "note"/"image" entries.
    imageUrl: { type: String, trim: true, maxlength: 2000, default: "" },
    faviconUrl: { type: String, trim: true, maxlength: 2000, default: "" },
    siteName: { type: String, trim: true, maxlength: 120, default: "" },
  },
  { timestamps: true }
);

researchEntrySchema.index({ projectId: 1, updatedAt: -1 });

export type ResearchEntryDoc = InferSchemaType<typeof researchEntrySchema>;

export const ResearchEntry = models.ResearchEntry || model("ResearchEntry", researchEntrySchema);
