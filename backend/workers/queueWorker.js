import { receiveMessages, deleteMessage } from "../services/sqsService.js";
import { sleep } from "../utils/sleep.js";
import { QUEUE_URL } from "../config/sqs.js";
import { updateJobDelivery, findJobDeliveryByJobIdAndChannel } from "../services/jobDeliveryService.js";
import { aggregateJobStatus } from "../services/jobService.js";

// Worker function
async function processMessage(message) {
  let job = null;
  let receiveCount = 0;

  try {
    const snsNotification = JSON.parse(message.Body);
    job = JSON.parse(snsNotification.Message);
    job.channel = "email";
    receiveCount = Number(message.Attributes?.ApproximateReceiveCount || 1);

    // Idempotent processing - check if already processed
    const existingJobDelivery = await findJobDeliveryByJobIdAndChannel(
      job.jobId,
      job.channel
    );
    if (existingJobDelivery && existingJobDelivery.status === "FINISHED") {
      console.log(`[Worker] Job ${job.jobId} already processed, skipping`);
      await deleteMessage(QUEUE_URL, message.ReceiptHandle);
      return;
    }

    console.log(
      `[Worker] Processing job ${job.jobId}, attempt #${receiveCount}`
    );

    // Update status to RUNNING
    await updateJobDelivery(existingJobDelivery._id, {
      status: "RUNNING",
      startedAt: new Date(),
      messageId: message.MessageId,
    });
    
    await sleep(2000);

    if (Math.random() < 0.8) throw new Error("Simulated failure");

    console.log(`[Worker] Job ${job.jobId} finished successfully.`);

    await updateJobDelivery(existingJobDelivery._id, {
      status: "FINISHED",
      finishedAt: new Date(),
    });

    // Aggregate overall job status
    await aggregateJobStatus(job.jobId);

    await deleteMessage(QUEUE_URL, message.ReceiptHandle);
  } catch (error) {
    console.error(`[Worker] Error processing job:`, error.message);
    // Do NOT delete → SQS will handle DLQ routing after 3rd attempt
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
