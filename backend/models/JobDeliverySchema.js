import mongoose from "mongoose";

const jobDeliverySchema = new mongoose.Schema(
  {
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: "Job", required: true },
    channel: { type: String, required: true }, // "notification", "email"
    status: {
      type: String,
      enum: ["PENDING", "RUNNING", "FINISHED", "FAILED"],
      default: "PENDING",
    },
    attemptCount: { type: Number, default: 0 },
    messageId: { type: String }, // SQS messageId
    lastError: { type: String },
    startedAt: { type: Date },
    finishedAt: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.model("JobDelivery", jobDeliverySchema);
