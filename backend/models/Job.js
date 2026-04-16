const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const jobSchema = new mongoose.Schema(
  {
    id: { type: String, default: uuidv4, index: true },
    name: { type: String, required: true, unique: true },

    status: {
      type: String,
      enum: ["CREATED", "QUEUED", "RUNNING", "FINISHED", "FAILED"],
      default: "CREATED",
      index: true
    },

    result: { type: String },
    error: { type: String },

    startedAt: { type: Date },
    finishedAt: { type: Date }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Job", jobSchema);
