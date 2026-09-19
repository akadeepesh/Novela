import { Schema, model, models, type InferSchemaType } from "mongoose";

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    // Hashed with bcrypt — never store or return plaintext.
    passwordHash: { type: String, required: true, select: false },
    image: { type: String },
  },
  { timestamps: true }
);

export type UserDoc = InferSchemaType<typeof userSchema>;

// `models.User` guards against Next.js hot-reload recompiling the model
// and mongoose throwing "OverwriteModelError".
export const User = models.User || model("User", userSchema);
