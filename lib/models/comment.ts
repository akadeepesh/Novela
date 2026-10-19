import { Schema, model, models, type InferSchemaType } from "mongoose";

/**
 * A comment on a stretch of a chapter. Two kinds share this collection:
 *  - the writer's own margin notes ("owner"), anchored by a `comment` mark
 *    in the chapter text that carries this comment's id;
 *  - beta readers' comments ("reader"), left through a share link. Readers
 *    can't change the text, so theirs are anchored by the quoted passage.
 */
const commentSchema = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    chapterId: { type: Schema.Types.ObjectId, ref: "Chapter", required: true },
    // The writer who owns the project, whoever wrote the comment.
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    authorKind: { type: String, enum: ["owner", "reader"], required: true },
    // Readers type a display name; the writer's own notes leave it empty.
    authorName: { type: String, trim: true, maxlength: 60, default: "" },
    shareLinkId: { type: Schema.Types.ObjectId, ref: "ShareLink" },
    body: { type: String, required: true, trim: true, maxlength: 2000 },
    // The passage commented on, as it read at the time.
    quote: { type: String, trim: true, maxlength: 500, default: "" },
    resolved: { type: Boolean, default: false },
    // Reader comments start unseen, for the "new comments" count.
    seenByOwner: { type: Boolean, default: true },
  },
  { timestamps: true }
);

commentSchema.index({ chapterId: 1, createdAt: 1 });
commentSchema.index({ ownerId: 1, seenByOwner: 1 });

export type CommentDoc = InferSchemaType<typeof commentSchema>;

export const Comment = models.Comment || model("Comment", commentSchema);
