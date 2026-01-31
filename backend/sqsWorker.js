// sqsWorker.js
import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from "@aws-sdk/client-sqs";
import dotenv from "dotenv";
import Job from "./models/Job.js";
import mongoose from "mongoose";

dotenv.config();

const REGION = process.env.AWS_REGION || "us-east-1";
const QUEUE_URL = process.env.SQS_QUEUE_URL;

// Create SQS client
const sqs = new SQSClient({ 
  region: REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});
mongoose.connect("mongodb://127.0.0.1:27017/jobs")
  .then(() => console.log("Connected to MongoDB"))
  .catch(err => console.error("MongoDB connection error:", err));

// Simulate processing delay
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Worker function
async function processMessage(message) {
  try {
    const job = JSON.parse(message.Body);

    const receiveCount = Number(
      message.Attributes?.ApproximateReceiveCount || 1
    );

    console.log(
      `[Worker] Processing job ${job.jobId}, attempt #${receiveCount}`
    );

    await sleep(2000);

    if (Math.random() < 0.8) throw new Error("Simulated failure");

    console.log(`[Worker] Job ${job.jobId} finished successfully.`);

    await Job.findByIdAndUpdate(job.jobId, { status: "FINISHED" });

    await sqs.send(new DeleteMessageCommand({
      QueueUrl: QUEUE_URL,
      ReceiptHandle: message.ReceiptHandle
    }));

  } catch (error) {
    console.error(`[Worker] Error processing job:`, error.message);
    // Do NOT delete → retry
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
        VisibilityTimeout: 20,        // time to process message before it becomes visible again
        AttributeNames: ["ApproximateReceiveCount"]
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
