import { Schema, model, models, type InferSchemaType } from "mongoose";
import { PROJECT_TYPES, SECTION_DEFS } from "@/lib/project-config";

const PROJECT_TYPE_VALUES = PROJECT_TYPES.map((t) => t.value);
const SECTION_ID_VALUES = Object.keys(SECTION_DEFS);

const projectSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    type: { type: String, enum: PROJECT_TYPE_VALUES, required: true },
    genre: { type: String, trim: true, maxlength: 60 },
    blurb: { type: String, trim: true, maxlength: 2000 },
    targetWordCount: { type: Number, min: 0 },
    // Ordered snapshot of enabled sidebar sections for this project —
    // computed once at creation from project-config presets, then stored,
    // so changing the presets later never reshuffles an existing project.
    sections: {
      type: [{ type: String, enum: SECTION_ID_VALUES }],
      required: true,
      default: [],
    },
  },
  { timestamps: true }
);

export type ProjectDoc = InferSchemaType<typeof projectSchema>;

export const Project = models.Project || model("Project", projectSchema);
