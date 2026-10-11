import { Schema, model, models, type InferSchemaType } from "mongoose";
import { PROJECT_TYPES, SECTION_DEFS } from "@/lib/project-config";
import { BACKGROUND_IDS, LINE_WIDTHS } from "@/lib/manuscript-config";
import { CHAPTER_NUMBERING_STYLE_IDS } from "@/lib/chapter-numbering";
import { TRIM_SIZE_IDS } from "@/lib/export-config";

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
    deletedAt: { type: Date },
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
    // Back-cover blurb (Part 4.2) — reuses the pre-existing `blurb` field
    // (originally a decorative "synopsis" field, removed from the UI in
    // Part 1.2) rather than adding a new one; it's already in the schema
    // and already carried through export, just never surfaced or written
    // to from anywhere since that removal.
    // Chapter numbering (Part 4.2) — "Chapter One" / "1" / a custom prefix
    // / none, applied to every chapter/poem/script title on export.
    chapterNumberingStyle: { type: String, enum: CHAPTER_NUMBERING_STYLE_IDS, default: "numeral" },
    chapterNumberingPrefix: { type: String, trim: true, maxlength: 40, default: "" },
    // Export default (Part 4.2) — PDF-only; EPUB reflows and DOCX exports
    // at standard US Letter regardless.
    exportTrimSize: { type: String, enum: TRIM_SIZE_IDS, default: "6x9" },
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

// Soft delete: a project with a deletedAt is in the Trash. It is restorable
// until it is purged (see lib/trash.ts); every normal query filters it out.
projectSchema.index({ ownerId: 1, deletedAt: 1 });

export const Project = models.Project || model("Project", projectSchema);
