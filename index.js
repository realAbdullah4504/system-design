const express = require("express");
const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const app = express();
app.use(express.json());

// --- MongoDB Setup ---
mongoose.connect("mongodb://127.0.0.1:27017/minimal-api");

// --- Job Schema ---
const jobSchema = new mongoose.Schema({
  id: { type: String, default: uuidv4 },
  name: { type: String, required: true },
  status: {
    type: String,
    enum: ["CREATED", "RUNNING", "FAILED", "FINISHED"],
    default: "CREATED",
  },
  createdAt: { type: Date, default: Date.now },
  finishedAt: { type: Date },
});

const Job = mongoose.model("Job", jobSchema);

// --- API Routes ---

// Create a new job
app.post("/jobs", async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "Job name is required" });

  const job = new Job({ name });
  await job.save();
  res.json(job);
});

// Get job status
app.get("/jobs/:id", async (req, res) => {
  const job = await Job.findOne({ id: req.params.id });
  if (!job) return res.status(404).json({ error: "Job not found" });
  res.json(job);
});

function simulateIODelay(duration) {
  return new Promise((resolve) => setTimeout(resolve, duration));
}
// Run a job (simulate real-world blocking & failures)
app.post("/jobs/:id/run", async (req, res) => {
  const job = await Job.findOne({ id: req.params.id });
  if (!job) return res.status(404).json({ error: "Job not found" });
  if (job.status !== "CREATED")
    return res.status(400).json({ error: "Job already running or finished" });

  // Update status to RUNNING
  job.status = "RUNNING";
  await job.save();
  // Simulate CPU-heavy blocking task (2-5s)
  res.json({ message: "Job started", job });
  
  const duration = Math.floor(Math.random() * 3000) + 2000;
  const start = Date.now();
  //   while (Date.now() - start < duration) {} // blocks Node

  await simulateIODelay(duration);
  // Random failure simulation
  if (Math.random() < 0.3) {
    job.status = "FAILED";
    await job.save();
    console.log(`Job ${job.id} failed after ${duration}ms`);
  } else {
    job.status = "FINISHED";
    job.finishedAt = new Date();
    await job.save();
    console.log(`Job ${job.id} finished after ${duration}ms`);
  }
});

// --- Start Server ---
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Minimal API running at http://localhost:${PORT}`);
});
