import express from "express";
import os from "os";
import { sendMessage } from "./services/sqs.js";
import { pollQueue } from "./worker.js";
const app = express();
app.use(express.json());


app.use((req, res, next) => {
  console.log(`[${process.env.HOSTNAME}] ${req.method} ${req.url}`);
  next();
});

app.get("/stress-cpu", async (req, res) => {
  // Push job to SQS instead of processing here
  const job = {
    type: "cpu-intensive",
    payload: { iterations: 1e7 }, // example workload
    timestamp: Date.now(),
  };

  try {
    await sendMessage(job);

    res.json({
      ok: true,
      status: "Job submitted to queue",
      server: os.hostname(),
    });
  } catch (err) {
    console.error("SQS sendMessage error:", err);
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
    timestamp: new Date().toISOString()
  });
});


app.listen(3000, () => {
  console.log("API running on port 3000");
  pollQueue();
});