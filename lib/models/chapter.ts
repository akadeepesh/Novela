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
    // Bumped by 1 on every save. A save must say which version it was based on;
    // if someone else saved in between (another tab or device) it is rejected
    // as a conflict instead of silently overwriting their text. Chapters that
    // existed before this field are treated as version 0.
    version: { type: Number, default: 0 },
    // sha256 of the stored content JSON. Lets saves and snapshots tell "did the
    // text actually change?" without re-serialising the whole chapter.
    contentHash: { type: String },
    // When the last automatic/big-delete snapshot was taken. Kept on the chapter
    // so a normal save needs no extra query to know whether one is due.
    lastSnapshotAt: { type: Date },
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
