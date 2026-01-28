const express = require("express");
const mongoose = require("mongoose");
const Job = require("./models/Job");
const { kafka } = require("./kafka");

const app = express();
app.use(express.json());

mongoose.connect("mongodb://127.0.0.1:27017/jobs");

const topic = process.env.KAFKA_JOBS_TOPIC || "jobs";
const producer = kafka.producer();

app.post("/jobs", async (req, res) => {
  const { name } = req.body;
  try {
    const job = await Job.create({
      name,
      status: "CREATED",
    });

    await Job.findByIdAndUpdate(job._id, { status: "QUEUED" });

    await producer.send({
      topic,
      messages: [
        {
          key: job._id.toString(),
          value: JSON.stringify({ jobId: job._id.toString() }),
        },
      ],
    });

    res.status(202).json({ jobId: job._id });
  } catch (error) {
    console.error("Error creating job:", error);
    res.status(500).json({ error: "Failed to create job" });
  }
});

app.get("/jobs/:id", async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ error: "Job not found" });
    res.json(job);
  } catch (error) {
    console.error("Error fetching job:", error);
    res.status(500).json({ error: "Failed to fetch job" });
  }
});

app.get("/jobs", async (req, res) => {
  try {
    const jobs = await Job.find().sort({ createdAt: -1 }).limit(100);
    res.json(jobs);
  } catch (error) {
    console.error("Error listing jobs:", error);
    res.status(500).json({ error: "Failed to list jobs" });
  }
});

async function start() {
  await producer.connect();

  app.listen(3000, () => {
    console.log("API running on port 3000");
  });
}

start().catch((error) => {
  console.error("Failed to start API:", error);
  process.exit(1);
});

async function shutdown() {
  try {
    await producer.disconnect();
  } catch (error) {
    console.error("Error disconnecting Kafka producer:", error);
  }
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
