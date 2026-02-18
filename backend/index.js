import express from "express";
import os from "os";
import { publishJobEvent } from "./services/sns.js";
const app = express();
app.use(express.json());

app.use((req, res, next) => {
  console.log(`[${process.env.HOSTNAME}] ${req.method} ${req.url}`);
  next();
});

app.get("/stress-cpu", async (req, res) => {
  // Push job to SQS instead of processing here
  const channels = ["notification", "email"];
  const message = {
    jobId: "test-job-id",
    name: "test-job",
    task: "test-job",
    duration: 1000,
    channels,
    createdAt: new Date().toISOString(),
  };

  try {
    await publishJobEvent(message);

    console.log(`[Producer] Sent job ${message.jobId} to SNS`);

    res.json({
      ok: true,
      status: "Job submitted to queue",
      server: os.hostname(),
    });
  } catch (err) {
    console.error("SNS publishJobEvent error:", err);
    res.status(500).json({ ok: false, error: "Failed to enqueue job" });
  }
});

// Async "I/O-bound" simulation (does NOT block event loop)
app.get("/async-wait", async (req, res) => {
  await new Promise((resolve) => setTimeout(resolve, 200));
  res.json({
    ok: true,
    type: "Async I/O-bound",
  });
});

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "notification-service",
    instanceId: process.env.HOSTNAME || "unknown",
    timestamp: new Date().toISOString(),
  });
});

app.listen(3000, () => {
  console.log("API running on port 3000");
});
