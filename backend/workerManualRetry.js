const kafka = require("./kafka");
const mongoose = require("mongoose");
const Job = require("./models/Job");

const WORKER_NAME = process.env.WORKER_NAME || "worker-A";
const GROUP_ID = process.env.GROUP_ID || "group-A";

// Retry configuration
const MAX_RETRY_ATTEMPTS = Number.parseInt(process.env.MAX_RETRY_ATTEMPTS) || 3;
const INITIAL_RETRY_DELAY = Number.parseInt(process.env.INITIAL_RETRY_DELAY) || 1000; // 1 second
const MAX_RETRY_DELAY = Number.parseInt(process.env.MAX_RETRY_DELAY) || 30000; // 30 seconds

// Exponential backoff with jitter
function getRetryDelay(attempt) {
  const baseDelay = Math.min(INITIAL_RETRY_DELAY * Math.pow(2, attempt - 1), MAX_RETRY_DELAY);
  // Add jitter to prevent thundering herd
  return baseDelay + Math.random() * 1000;
}

// Retry wrapper for message processing
async function processMessageWithRetry(topic, partition, message, attempt = 1) {
  const data = JSON.parse(message.value.toString());
  const jobId = data.jobId;

  console.log(`[${WORKER_NAME}] Attempt ${attempt}/${MAX_RETRY_ATTEMPTS} processing job`, jobId);

  try {
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
    if (Math.random() < 0.9) {
      console.log(`[${WORKER_NAME}] SIMULATED CRASH BEFORE COMMIT`);
      throw new Error("Simulated crash");
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

  } catch (error) {
    console.error(`[${WORKER_NAME}] Error processing job ${jobId} on attempt ${attempt}:`, error.message);
    
    // Update job status to FAILED if max retries reached
    if (attempt >= MAX_RETRY_ATTEMPTS) {
      await Job.findByIdAndUpdate(jobId, {
        status: "FAILED",
        error: `Failed after ${MAX_RETRY_ATTEMPTS} attempts: ${error.message}`,
        finishedAt: new Date()
      });
      
      // Commit offset to move to next message after max retries
      await consumer.commitOffsets([
        { topic, partition, offset: (Number(message.offset) + 1).toString() }
      ]);
      
      console.error(`[${WORKER_NAME}] Job ${jobId} marked as FAILED after ${MAX_RETRY_ATTEMPTS} attempts`);
      return;
    }

    // Retry logic
    const delay = getRetryDelay(attempt);
    console.log(`[${WORKER_NAME}] Retrying job ${jobId} in ${Math.round(delay)}ms...`);
    
    await new Promise(resolve => setTimeout(resolve, delay));
    return processMessageWithRetry(topic, partition, message, attempt + 1);
  }
}

mongoose.connect("mongodb://127.0.0.1:27017/jobs");

const consumer = kafka.consumer({ groupId: GROUP_ID });

async function start() {
  await consumer.connect();
  await consumer.subscribe({ topic: "jobs" });

  await consumer.run({
    autoCommit: false, // ✅ Disable auto commit
    eachMessage: async ({ topic, partition, message }) => {
      await processMessageWithRetry(topic, partition, message);
    },
  });
}

start();
