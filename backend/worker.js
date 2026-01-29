const kafka = require("./kafka");
const mongoose = require("mongoose");
const Job = require("./models/Job");

const WORKER_NAME = process.env.WORKER_NAME || "worker-A";
const GROUP_ID = process.env.GROUP_ID || "group-A";

mongoose.connect("mongodb://127.0.0.1:27017/jobs");

const consumer = kafka.consumer({ groupId: GROUP_ID });
const producer = kafka.producer(); // For retry & DLQ

// Retry configuration
const MAX_RETRIES = Number.parseInt(process.env.MAX_RETRIES) || 3;

// Retry topics (can have multiple for backoff)
const RETRY_TOPICS = ["jobs.retry.5s", "jobs.retry.30s"];
const DLQ_TOPIC = "jobs.DLQ";

// Helper to produce messages
async function sendMessage(topic, message) {
  await producer.send({
    topic,
    messages: [{ value: JSON.stringify(message) }],
  });
}

// Processing logic
async function processJobMessage(topic, partition, message) {
  const data = JSON.parse(message.value.toString());
  const jobId = data.jobId;
  data.retryCount = data.retryCount || 0;

  console.log(`[${WORKER_NAME}] Processing job ${jobId}, attempt ${data.retryCount + 1}`);

  try {
    // Idempotency: skip if already finished
    const existingJob = await Job.findById(jobId);
    if (!existingJob || existingJob.status === "FINISHED") {
      console.log(`[${WORKER_NAME}] Job already finished, skipping ${jobId}`);
      await consumer.commitOffsets([
        { topic, partition, offset: (Number(message.offset) + 1).toString() },
      ]);
      return;
    }

    // Update status to RUNNING
    await Job.findByIdAndUpdate(jobId, {
      status: "RUNNING",
      processedBy: WORKER_NAME,
    });

    // Simulate work
    await new Promise((r) => setTimeout(r, 2000));

    // Random failure simulation
    if (Math.random() < 0.8) throw new Error("Simulated failure");

    // Mark job FINISHED
    await Job.findByIdAndUpdate(jobId, {
      status: "FINISHED",
      finishedAt: new Date(),
    });

    console.log(`[${WORKER_NAME}] FINISHED job ${jobId}`);

    // Commit offset after success
    await consumer.commitOffsets([
      { topic, partition, offset: (Number(message.offset) + 1).toString() },
    ]);
  } catch (error) {
    console.error(`[${WORKER_NAME}] Error processing job ${jobId}: ${error.message}`);

    data.retryCount += 1;

    if (data.retryCount > MAX_RETRIES) {
      console.log(`[${WORKER_NAME}] Sending job ${jobId} to DLQ`);
      await Job.findByIdAndUpdate(jobId, {
        status: "FAILED",
        error: error.message,
        finishedAt: new Date(),
      });
      await sendMessage(DLQ_TOPIC, data);
    } else {
      // Decide retry topic based on attempt (simple backoff)
      const retryTopic = data.retryCount === 1 ? RETRY_TOPICS[0] : RETRY_TOPICS[1];
      console.log(`[${WORKER_NAME}] Retrying job ${jobId}, sending to ${retryTopic}`);
      await sendMessage(retryTopic, data);
    }

    // Commit offset regardless to move on
    await consumer.commitOffsets([
      { topic, partition, offset: (Number(message.offset) + 1).toString() },
    ]);
  }
}

// Start consumer
async function start() {
  await producer.connect();
  await consumer.connect();

  // Subscribe to main + retry topics
  const topics = ["jobs", ...RETRY_TOPICS];
  for (const t of topics) await consumer.subscribe({ topic: t });

  await consumer.run({
    autoCommit: false,
    eachMessage: async ({ topic, partition, message }) => {
      await processJobMessage(topic, partition, message);
    },
  });

  console.log(`[${WORKER_NAME}] Consumer started for topics: ${topics.join(", ")}`);
}

start().catch(console.error);
