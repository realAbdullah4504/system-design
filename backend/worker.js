const { Worker, QueueEvents } = require("bullmq");
const connection = require("./queue/redis");
const Job = require("./models/Job");
const dlqQueue = require("./queue/dlq");
const mongoose = require("mongoose");

mongoose.connect("mongodb://127.0.0.1:27017/jobs");

const worker = new Worker(
  "jobs",
  async (job) => {
    const { jobId } = job.data;

    await Job.findByIdAndUpdate(jobId, {
      status: "RUNNING",
      startedAt: new Date(),
    });

    // simulate work
    // if (Math.random() < 0.7) throw new Error("Intentional failure for testing");

    await new Promise((r) => setTimeout(r, 5000));

    await Job.findByIdAndUpdate(jobId, {
      status: "FINISHED",
      finishedAt: new Date(),
    });
    console.log(`Job ${job.id} completed`);
  },
  {
    connection,
    lockDuration: 15000,
    attempts: 3, // retry max 3 times
    backoff: { type: "exponential", delay: 2000 },
  }
);

// --- QueueEvents listen for failed jobs ---
// const queueEvents = new QueueEvents("jobs", { connection });

// queueEvents.on("failed", async ({ jobId, failedReason, prev }) => {
//   const job = await worker.getJob(jobId);

//   if (!job) return;

//   // Check if max attempts reached
//   if (job.attemptsMade >= job.opts.attempts) {
//     console.log(`💀 Job ${job.id} exceeded retries. Moving to DLQ`);

//     // move job to DLQ with original data and reason
//     await dlqQueue.add(job.name, {
//       originalJobId: job.id,
//       data: job.data,
//       failedReason,
//       failedAt: new Date(),
//     });

//     // Optional: remove from main queue
//     await job.remove();
//   }
// });

worker.on("completed", (job) => console.log(`✅ Job ${job.id} completed`));
worker.on("failed", (job, err) =>
  console.log(`❌ Job ${job.id} failed attempt ${job.attemptsMade}: ${err.message}`)
);
