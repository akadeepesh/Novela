import { Schema, model, models, type InferSchemaType } from "mongoose";

/**
 * A private link that lets anyone who has it read a project (no account
 * needed) and, if allowed, comment on it. The token is the only secret:
 * unguessable, never derived from ids, and revocable at any time.
 */
const shareLinkSchema = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    token: { type: String, required: true, unique: true },
    // What the writer calls it ("Writing group", "Mum"), to tell links apart.
    name: { type: String, trim: true, maxlength: 60, default: "" },
    allowComments: { type: Boolean, default: false },
    // bcrypt hash; readers must enter the password once per browser.
    passwordHash: { type: String, select: false },
    expiresAt: { type: Date },
    revokedAt: { type: Date },
    viewCount: { type: Number, default: 0 },
    lastViewedAt: { type: Date },
  },
  { timestamps: true }
);

export type ShareLinkDoc = InferSchemaType<typeof shareLinkSchema>;

export const ShareLink = models.ShareLink || model("ShareLink", shareLinkSchema);
