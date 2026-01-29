// sqsWorker.js
import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from "@aws-sdk/client-sqs";
import dotenv from "dotenv";
import Job from "./models/Job.js";

dotenv.config();

const REGION = process.env.AWS_REGION || "us-east-1";
const QUEUE_URL = process.env.SQS_QUEUE_URL;

// Create SQS client
const sqs = new SQSClient({ region: REGION });

// Simulate processing delay
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Worker function
async function processMessage(message) {
  try {
    const job = JSON.parse(message.Body);
    console.log(`[Worker] Processing job ${job.jobId}, task: ${job.name || job.task}`);

    // Simulate work (2 seconds)
    await sleep(2000);

    // Random failure simulation
    if (Math.random() < 0.2) throw new Error("Simulated failure");

    console.log(`[Worker] Job ${job.jobId} finished successfully.`);

    // Update job status in MongoDB
    await Job.findByIdAndUpdate(job.jobId, { status: "FINISHED" });

    // Delete message from queue after successful processing
    await sqs.send(new DeleteMessageCommand({
      QueueUrl: QUEUE_URL,
      ReceiptHandle: message.ReceiptHandle
    }));
  } catch (error) {
    if (error instanceof SyntaxError) {
      console.error(`[Worker] Invalid JSON in message: ${message.Body}`);
    } else {
      console.error(`[Worker] Error processing job:`, error.message);
    }
    // Do NOT delete message → SQS will retry automatically after visibility timeout
  }
}

// Polling loop
async function pollQueue() {
  while (true) {
    try {
      const data = await sqs.send(new ReceiveMessageCommand({
        QueueUrl: QUEUE_URL,
        MaxNumberOfMessages: 5,      // batch of messages
        WaitTimeSeconds: 10,         // long polling
        VisibilityTimeout: 20        // time to process message before it becomes visible again
      }));

      if (data.Messages) {
        // Process each message in parallel
        await Promise.all(data.Messages.map(processMessage));
      } else {
        // console.log("No messages in queue, polling...");
      }
    } catch (err) {
      console.error("Error receiving messages:", err);
    }
  }
}

// Start the worker
pollQueue();
