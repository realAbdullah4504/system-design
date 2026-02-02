import mongoose from "mongoose";

const jobSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },

    status: {
      type: String,
      enum: ["CREATED", "QUEUED", "RUNNING", "FINISHED", "FAILED"],
      default: "CREATED",
      index: true
    },

    result: { type: String },
    error: { type: String },
    messageId: { type: String, index: true }, // For idempotency

    startedAt: { type: Date },
    finishedAt: { type: Date }
  },
  { timestamps: true }
);

// Compound index for idempotency
jobSchema.index({ messageId: 1 }, { unique: true });

export default mongoose.model("Job", jobSchema);
