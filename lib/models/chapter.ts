import { Schema, model, models, type InferSchemaType } from "mongoose";

const chapterSchema = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200, default: "Untitled" },
    // Tiptap document JSON (ProseMirror JSON). Stored as-is — Mongo's
    // schemaless Mixed type suits a document whose shape we don't want to
    // hand-model field by field.
    content: { type: Schema.Types.Mixed, default: null },
    order: { type: Number, required: true, default: 0 },
    wordCount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["draft", "in-progress", "done"],
      default: "draft",
    },
  },
  { timestamps: true }
);

chapterSchema.index({ projectId: 1, order: 1 });
// Serves the dashboard's "most recently edited chapter" lookup.
chapterSchema.index({ ownerId: 1, updatedAt: -1 });

export type ChapterDoc = InferSchemaType<typeof chapterSchema>;

export const Chapter = models.Chapter || model("Chapter", chapterSchema);
