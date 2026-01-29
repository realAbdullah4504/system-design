// server.js
import express from "express";
import mongoose from "mongoose";
import Job from "./models/Job.js";
import { startAllProducers, publishMainJob } from "./producers.js";

const app = express();
app.use(express.json());

// Connect to MongoDB with error handling
mongoose.connect("mongodb://127.0.0.1:27017/jobs")
  .then(() => console.log("Connected to MongoDB"))
  .catch(err => console.error("MongoDB connection error:", err));

startAllProducers();

app.post("/jobs", async (req, res) => {
  try {
    const job = await Job.create({ name: req.body.name });

    // Send job to SQS
    await publishMainJob(job);

    res.json({ jobId: job._id });
  } catch (err) {
    console.error("Error creating job:", err);
    res.status(500).json({ error: "Failed to create job" });
  }
});

app.get("/jobs/:id", async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ error: "Job not found" });
    res.json(job);
  } catch (err) {
    console.error("Error fetching job:", err);
    res.status(500).json({ error: "Failed to fetch job" });
  }
});

app.listen(3000, () => {
  console.log("API running on port 3000");
});
