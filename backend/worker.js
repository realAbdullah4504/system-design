const mongoose = require("mongoose");
const Job = require("./models/Job");
const { kafka } = require("./kafka");

mongoose.connect("mongodb://127.0.0.1:27017/jobs");

const topic = process.env.KAFKA_JOBS_TOPIC || "jobs";
const consumerId = process.env.WORKER_ID || String(process.pid);

// Same groupId => partitioned work (load balancing)
// Different groupId per worker => fanout (each worker sees every message)
const groupId = process.env.KAFKA_GROUP_ID || "jobs-workers";
const consumer = kafka.consumer({ groupId });

async function processJob(jobId, { consumerId }) {
  await Job.findByIdAndUpdate(jobId, {
    status: "RUNNING",
    startedAt: new Date(),
  });

  // simulate work
  if (Math.random() < 0.7) throw new Error("Intentional failure for testing");

  await new Promise((r) => setTimeout(r, 5000));

  await Job.findByIdAndUpdate(jobId, {
    status: "FINISHED",
    finishedAt: new Date(),
  });

  console.log(`✅ Job ${jobId} finished by consumer ${consumerId}`);
}

async function start() {
  await consumer.connect();
  await consumer.subscribe({ topic, fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message, partition }) => {
      let payload;
      try {
        const raw = message.value ? message.value.toString() : "";
        payload = raw ? JSON.parse(raw) : null;
      } catch (error) {
        console.error("Invalid message payload:", error);
        return;
      }

      const jobId = payload?.jobId;
      if (!jobId) {
        console.error("Missing jobId in message", {
          partition,
          key: message.key ? message.key.toString() : null,
        });
        return;
      }

      console.log(
        `📥 Consumed job ${jobId} (partition ${partition}) key=${
          message.key ? message.key.toString() : ""
        }`
      );

      try {
        await processJob(jobId, { consumerId });
      } catch (error) {
        await Job.findByIdAndUpdate(jobId, {
          status: "FAILED",
          finishedAt: new Date(),
          error: error.message,
        });

        console.log(`❌ Job ${jobId} failed: ${error.message}`);
      }
    },
  });
}

start().catch((error) => {
  console.error("Failed to start Kafka worker:", error);
  process.exit(1);
});

async function shutdown() {
  try {
    await consumer.disconnect();
  } catch (error) {
    console.error("Error disconnecting Kafka consumer:", error);
  }
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
