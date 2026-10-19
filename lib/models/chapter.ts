import { Schema, model, models, type InferSchemaType } from "mongoose";
import { CHAPTER_LABELS } from "@/lib/chapter-config";

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
    // A line or two on what happens here, shown on the outline board.
    synopsis: { type: String, trim: true, maxlength: 1000, default: "" },
    // Optional colour tag for the outline board (e.g. one per POV character).
    label: { type: String, enum: CHAPTER_LABELS, default: "" },
    // Soft delete: a chapter with a deletedAt is in the Trash, restorable
    // until purged (see lib/trash.ts). Every normal query filters it out.
    deletedAt: { type: Date },
  },
  { timestamps: true }
);

chapterSchema.index({ projectId: 1, deletedAt: 1, order: 1 });
// Serves the dashboard's "most recently edited chapter" lookup.
chapterSchema.index({ ownerId: 1, updatedAt: -1 });

export type ChapterDoc = InferSchemaType<typeof chapterSchema>;

/**
 * The one reading order for chapters, used by every list, export, the Read
 * view and reordering. `createdAt` breaks ties, so two chapters that ended up
 * with the same `order` still come out the same way everywhere.
 */
export const CHAPTER_ORDER = { order: 1, createdAt: 1 } as const;

export const Chapter = models.Chapter || model("Chapter", chapterSchema);
