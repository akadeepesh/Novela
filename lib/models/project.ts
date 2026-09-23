import { Schema, model, models, type InferSchemaType } from "mongoose";
import { PROJECT_TYPES, SECTION_DEFS } from "@/lib/project-config";
import { BACKGROUND_IDS, LINE_WIDTHS } from "@/lib/manuscript-config";

const PROJECT_TYPE_VALUES = PROJECT_TYPES.map((t) => t.value);
const SECTION_ID_VALUES = Object.keys(SECTION_DEFS);

const manuscriptSettingsSchema = new Schema(
  {
    background: { type: String, enum: BACKGROUND_IDS, default: "paper" },
    backgroundImageUrl: { type: String, trim: true, default: "" },
    showHeader: { type: Boolean, default: false },
    headerText: { type: String, trim: true, maxlength: 120, default: "" },
    showFooter: { type: Boolean, default: false },
    footerText: { type: String, trim: true, maxlength: 120, default: "" },
    fontSize: { type: Number, min: 14, max: 28, default: 18 },
    lineHeight: { type: Number, min: 1.3, max: 2.2, default: 1.75 },
    lineWidth: { type: String, enum: LINE_WIDTHS, default: "medium" },
  },
  { _id: false }
);

const projectSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    type: { type: String, enum: PROJECT_TYPE_VALUES, required: true },
    genre: { type: String, trim: true, maxlength: 60 },
    blurb: { type: String, trim: true, maxlength: 2000 },
    authorName: { type: String, trim: true, maxlength: 120, default: "" },
    // Cover art (Part 4.1). Empty string, not undefined, when unset — Read
    // View and export both fall back to a generated typographic cover in
    // that case, so they only need to check for a truthy URL.
    coverFrontUrl: { type: String, trim: true, default: "" },
    coverBackUrl: { type: String, trim: true, default: "" },
    targetWordCount: { type: Number, min: 0 },
    dailyWordGoal: { type: Number, min: 0, max: 100_000, default: 300 },
    // Ordered snapshot of enabled sidebar sections for this project —
    // computed once at creation from project-config presets, then stored,
    // so changing the presets later never reshuffles an existing project.
    sections: {
      type: [{ type: String, enum: SECTION_ID_VALUES }],
      required: true,
      default: [],
    },
    manuscriptSettings: { type: manuscriptSettingsSchema, default: () => ({}) },
  },
  { timestamps: true }
);

export type ProjectDoc = InferSchemaType<typeof projectSchema>;

export const Project = models.Project || model("Project", projectSchema);
