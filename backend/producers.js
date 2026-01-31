// producers.js
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import dotenv from "dotenv";

dotenv.config();

// AWS region
const REGION = process.env.AWS_REGION || "us-east-1";

// SQS queue URL (main queue)
const QUEUE_URL = process.env.SQS_QUEUE_URL;

// Create SQS client
const sqs = new SQSClient({ 
  region: REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

// Send a single job to SQS
export async function publishMainJob(job) {
  try {
    const message = {
      jobId: job._id.toString(),
      name: job.name,
      task: job.name, // Add task field for worker compatibility
      retryCount: 0, // optional, for logging
      createdAt: new Date().toISOString(),
    };

    const command = new SendMessageCommand({
      QueueUrl: QUEUE_URL,
      MessageBody: JSON.stringify(message),
    });

    const result = await sqs.send(command);
    console.log(`[Producer] Sent job ${job._id} to SQS, MessageId: ${result.MessageId}`);
  } catch (err) {
    console.error(`[Producer] Failed to send job ${job._id} to SQS:`, err);
  }
}

// Start multiple producers if needed (simulated for local dev)
export function startAllProducers() {
  console.log("[Producer] Producers ready to send jobs");
}
