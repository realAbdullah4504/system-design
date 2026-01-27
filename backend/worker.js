const { Worker } = require("bullmq");
const connection = require("./queue/redis");
const Job = require("./models/Job");
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
    await new Promise((r) => setTimeout(r, 3000));

    await Job.findByIdAndUpdate(jobId, {
      status: "FINISHED",
      finishedAt: new Date(),
    });
  },
  { connection }
);

worker.on("completed", (job) => {
  console.log(`Job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  console.error(`Job ${job?.id} failed`, err);
});
