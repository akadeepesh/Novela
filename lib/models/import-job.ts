import { Schema, model, models, type InferSchemaType } from "mongoose";
import { PROJECT_TYPES } from "@/lib/project-config";
import { IMPORT_JOB_TTL_MS } from "@/lib/import/config";

const PROJECT_TYPE_VALUES = PROJECT_TYPES.map((t) => t.value);

const intakeSchema = new Schema(
  {
    pageCount: { type: Number, required: true },
    textPages: { type: Number, required: true },
    imageOnlyPages: { type: Number, required: true },
    imageOnlyApproximate: { type: Boolean, default: false },
    blankPages: { type: Number, required: true },
    encrypted: { type: Boolean, default: false },
  },
  { _id: false }
);

/**
 * Scratch record for one in-flight PDF import — lives between "the PDF
 * passed intake" and "the person confirmed the result and it became a real
 * Project" (or they walked away). Later pipeline steps add their own
 * fields and statuses here; nothing in this collection is a manuscript.
 */
const importJobSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    status: { type: String, enum: ["intake-passed", "intent-set"], default: "intake-passed" },
    // Pathname of the uploaded PDF in scratch Blob storage (imports/<userId>/…).
    // A pathname, not a URL: the blob is private and is only ever read
    // server-side, via the store token.
    sourcePathname: { type: String, required: true },
    fileName: { type: String, trim: true, maxlength: 255, default: "" },
    fileSize: { type: Number, default: 0 },
    intake: { type: intakeSchema, required: true },
    // Step 2 answers. Deliberately no defaults: "not answered yet" must stay
    // distinguishable from any real answer, since the type steers how
    // chapter boundaries get detected.
    projectType: { type: String, enum: PROJECT_TYPE_VALUES },
    hasFrontCover: { type: Boolean },
    // Abandoned imports expire on their own. NOTE: this only removes the
    // record — the scratch Blob needs its own sweep (tracked for the
    // orchestration step, where the job lifecycle actually lands).
    expiresAt: { type: Date, default: () => new Date(Date.now() + IMPORT_JOB_TTL_MS) },
  },
  { timestamps: true }
);

importJobSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type ImportJobDoc = InferSchemaType<typeof importJobSchema>;

export const ImportJob = models.ImportJob || model("ImportJob", importJobSchema);
