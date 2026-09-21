import { Schema, model, models, type InferSchemaType } from "mongoose";

const feedbackSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    message: { type: String, required: true, trim: true, maxlength: 4000 },
    // Where the person was when they sent it — useful context, zero cost
    // to capture since we already know the current URL client-side.
    page: { type: String, trim: true, maxlength: 300 },
  },
  { timestamps: true }
);

export type FeedbackDoc = InferSchemaType<typeof feedbackSchema>;

export const Feedback = models.Feedback || model("Feedback", feedbackSchema);
