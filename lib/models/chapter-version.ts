import { Schema, model, models, type InferSchemaType } from "mongoose";

const chapterVersionSchema = new Schema(
  {
    chapterId: { type: Schema.Types.ObjectId, ref: "Chapter", required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true },
    // Snapshot of the chapter's Tiptap JSON at the moment this version was
    // taken — intentionally a full copy rather than a diff, so restoring
    // never depends on replaying a chain of prior versions correctly.
    content: { type: Schema.Types.Mixed, default: null },
    wordCount: { type: Number, default: 0 },
    // "auto" snapshots are taken periodically while writing; "manual" ones
    // are explicit "Save version" clicks and a label the person chose.
    kind: { type: String, enum: ["auto", "manual", "restore-point"], default: "auto" },
    label: { type: String, trim: true, maxlength: 120 },
  },
  { timestamps: true }
);

chapterVersionSchema.index({ chapterId: 1, createdAt: -1 });

export type ChapterVersionDoc = InferSchemaType<typeof chapterVersionSchema>;

export const ChapterVersion = models.ChapterVersion || model("ChapterVersion", chapterVersionSchema);
