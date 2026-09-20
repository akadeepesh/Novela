import { Schema, model, models, type InferSchemaType } from "mongoose";

const noteSchema = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, trim: true, maxlength: 160, default: "Untitled Note" },
    content: { type: String, trim: true, maxlength: 20000, default: "" },
    tags: { type: [String], default: [] },
    pinned: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Pinned notes first, most recently touched next — matches how the list renders.
noteSchema.index({ projectId: 1, pinned: -1, updatedAt: -1 });

export type NoteDoc = InferSchemaType<typeof noteSchema>;

export const Note = models.Note || model("Note", noteSchema);
