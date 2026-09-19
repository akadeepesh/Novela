import { Schema, model, models, type InferSchemaType } from "mongoose";
import { CHARACTER_ROLES } from "@/lib/character-config";

const CHARACTER_ROLE_VALUES = CHARACTER_ROLES.map((r) => r.value);

const characterSchema = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    role: { type: String, enum: CHARACTER_ROLE_VALUES, default: "supporting" },
    // Alternate names this character might be referred to by in the
    // manuscript (nicknames, titles, maiden names) — kept from day one so
    // the future @mention/backlink system (Part 3 continued) can match a
    // character even when the text doesn't use their exact profile name.
    aliases: { type: [String], default: [] },
    imageUrl: { type: String, trim: true, maxlength: 2000, default: "" },
    appearance: { type: String, trim: true, maxlength: 4000, default: "" },
    personality: { type: String, trim: true, maxlength: 4000, default: "" },
    backstory: { type: String, trim: true, maxlength: 4000, default: "" },
    notes: { type: String, trim: true, maxlength: 4000, default: "" },
  },
  { timestamps: true }
);

characterSchema.index({ projectId: 1, name: 1 });

export type CharacterDoc = InferSchemaType<typeof characterSchema>;

export const Character = models.Character || model("Character", characterSchema);
