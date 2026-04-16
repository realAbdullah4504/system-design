const { Worker } = require("bullmq");
const connection = require("./queue/redis");
const Job = require("./models/Job");
const mongoose = require("mongoose");
require("dotenv").config({ path: __dirname + "/.env" });

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });

const worker = new Worker(
  "jobs",
  async (job) => {
    const { jobId } = job.data;
    try {
      await Job.findByIdAndUpdate(jobId, {
        status: "RUNNING",
        startedAt: new Date(),
      });

      console.log(`Job ${jobId} started`);

      // simulate work
      // if (Math.random() < 0.7) throw new Error("Intentional failure for testing");

      await new Promise((r) => setTimeout(r, 5000));

      await Job.findByIdAndUpdate(jobId, {
        status: "FINISHED",
        finishedAt: new Date(),
      });
      console.log(`Job ${job.id} completed`);
    } catch (err) {
      console.error("Error updating job:", err);
    }
  },
  {
    connection,
    lockDuration: 15000,
  }
);

worker.on("completed", (job) => console.log(`✅ Job ${job.id} completed`));
worker.on("failed", async (job, err) => {
  await Job.findByIdAndUpdate(job._id, {
    status: "Failed",
    finishedAt: new Date(),
  });
  console.log(
    `❌ Job ${job.id} failed attempt ${job.attemptsMade}: ${err.message}`
  );
});
