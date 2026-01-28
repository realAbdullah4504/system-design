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
    eachMessage: async ({ message }) => {
      const data = JSON.parse(message.value.toString());

      console.log(`[${WORKER_NAME}] processing job`, data.jobId);

      await Job.findByIdAndUpdate(data.jobId, {
        status: "RUNNING",
        processedBy: WORKER_NAME,
      });

      // simulate work
      await new Promise((r) => setTimeout(r, 2000));

      await Job.findByIdAndUpdate(data.jobId, {
        status: "FINISHED",
      });

      console.log(`[${WORKER_NAME}] finished job`, data.jobId);
    },
  });
}

start();
