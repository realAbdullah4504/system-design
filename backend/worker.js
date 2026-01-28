const kafka = require("./kafka");
const mongoose = require("mongoose");
const Job = require("./models/Job");

const WORKER_NAME = process.env.WORKER_NAME || "worker-A";
const GROUP_ID = process.env.GROUP_ID || "group-A";

mongoose.connect("mongodb://127.0.0.1:27017/jobs");

const consumer = kafka.consumer({ groupId: GROUP_ID });

async function start() {
  await consumer.connect();
  await consumer.subscribe({ topic: "jobs" });

  await consumer.run({
    autoCommit: false, // ✅ Disable auto commit
    eachMessage: async ({ topic, partition, message }) => {
      const data = JSON.parse(message.value.toString());
      const jobId = data.jobId;

      console.log(`[${WORKER_NAME}] START processing job`, jobId);

      // 🔹 Idempotent check: skip if already finished
      const existingJob = await Job.findById(jobId);
      if (!existingJob || existingJob.status === "FINISHED") {
        console.log(`[${WORKER_NAME}] Job already finished, skipping`, jobId);
        // commit offset anyway to advance
        await consumer.commitOffsets([
          { topic, partition, offset: (Number(message.offset) + 1).toString() }
        ]);
        return;
      }

      // Update status to RUNNING
      await Job.findByIdAndUpdate(jobId, {
        status: "RUNNING",
        processedBy: WORKER_NAME,
      });

      // Simulate work (2s)
      await new Promise((r) => setTimeout(r, 2000));

      // 🔹 Simulate crash randomly (to see effect)
      if (Math.random() < 0.3) {
        console.log(`[${WORKER_NAME}] SIMULATED CRASH BEFORE COMMIT`);
        process.exit(1);
      }

      // Mark job as FINISHED
      await Job.findByIdAndUpdate(jobId, {
        status: "FINISHED",
      });

      console.log(`[${WORKER_NAME}] FINISHED job`, jobId);

      // ✅ Commit offset manually AFTER work
      await consumer.commitOffsets([
        { topic, partition, offset: (Number(message.offset) + 1).toString() }
      ]);
    },
  });
}

start();
