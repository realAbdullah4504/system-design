const express = require("express");
const mongoose = require("mongoose");
const Job = require("./models/Job");
const { startWorker, recoverStuckJobs } = require("./worker");

const app = express();
app.use(express.json());

// --- MongoDB ---
mongoose.connect("mongodb://127.0.0.1:27017/stage-2-queue");

// --- Routes ---

// Create job
app.post("/jobs", async (req, res) => {
  const job = await Job.create({
    name: req.body.name,
  });

  res.status(201).json(job);
});

// Enqueue job
app.post("/jobs/:id/enqueue", async (req, res) => {
  const job = await Job.findOneAndUpdate(
    { id: req.params.id, status: "CREATED" },
    { status: "QUEUED" },
    { new: true }
  );

  if (!job) {
    return res
      .status(404)
      .json({ message: "Job not found or already enqueued" });
  }

  res.json(job);
});

// Get single job
app.get("/jobs/:id", async (req, res) => {
  const job = await Job.findOne({ id: req.params.id });

  if (!job) {
    return res.status(404).json({ message: "Job not found" });
  }

  res.json(job);
});

// List jobs
app.get("/jobs", async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;

  const jobs = await Job.find(filter).sort({ createdAt: -1 });
  res.json(jobs);
});

// --- Start ---
const PORT = 3000;
app.listen(PORT, async () => {
  console.log(`🚀 API running on port ${PORT}`);
  await recoverStuckJobs();
  startWorker();
});
