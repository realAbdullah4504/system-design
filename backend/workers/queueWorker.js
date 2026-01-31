import { receiveMessages, deleteMessage } from "../services/sqsService.js";
import { updateJobStatus } from "../services/jobService.js";
import { sleep } from "../utils/sleep.js";
import { QUEUE_URL } from "../config/sqs.js";

// Worker function
async function processMessage(message) {
  try {
    const job = JSON.parse(message.Body);
    const receiveCount = Number(message.Attributes?.ApproximateReceiveCount || 1);

    console.log(`[Worker] Processing job ${job.jobId}, attempt #${receiveCount}`);

    await sleep(2000);

    if (Math.random() < 0.8) throw new Error("Simulated failure");

    console.log(`[Worker] Job ${job.jobId} finished successfully.`);

    await updateJobStatus(job.jobId, { status: "FINISHED" });

    await deleteMessage(QUEUE_URL, message.ReceiptHandle);

  } catch (error) {
    console.error(`[Worker] Error processing job:`, error.message);
    
    const receiveCount = Number(message.Attributes?.ApproximateReceiveCount || 1);
    
    if (receiveCount >= 3) {
      console.log(`[Worker] Job ${job.jobId} exceeded max retries, updating status to FAILED`);
      await updateJobStatus(job.jobId, { 
        status: "FAILED",
        error: error.message,
        finishedAt: new Date()
      });
    }
  }
}

// Polling loop
async function pollQueue() {
  while (true) {
    try {
      const data = await receiveMessages(QUEUE_URL);

      if (data.Messages) {
        await Promise.all(data.Messages.map(processMessage));
      }
    } catch (err) {
      console.error("Error receiving messages:", err);
    }
  }
}

export { pollQueue };
