import { receiveMessages, deleteMessage } from "../services/sqsService.js";
import { sleep } from "../utils/sleep.js";
import { NOTIFICATION_QUEUE_URL } from "../config/sqs.js";
import {
  findJobDeliveryByJobIdAndChannel,
  updateJobDelivery,
} from "../services/jobDeliveryService.js";
import { aggregateJobStatus } from "../services/jobService.js";

// Worker function
async function processMessage(message) {
  let job = null;
  let receiveCount = 0;

  try {
    const snsNotification = JSON.parse(message.Body);
    job = JSON.parse(snsNotification.Message);
    job.channel = "notification";
    receiveCount = Number(message.Attributes?.ApproximateReceiveCount || 1);

    console.log(
      `[Worker] Processing job ${job.jobId}, attempt #${receiveCount}`
    );

    const existingJobDelivery = await findJobDeliveryByJobIdAndChannel(
      job.jobId,
      job.channel
    );
    if (existingJobDelivery && existingJobDelivery.status === "FINISHED") {
      console.log(`[Worker] Job ${job.jobId} already processed, skipping`);
      await deleteMessage(NOTIFICATION_QUEUE_URL, message.ReceiptHandle);
      return;
    }
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

    await deleteMessage(NOTIFICATION_QUEUE_URL, message.ReceiptHandle);
  } catch (error) {
    console.error(`[Worker] Error processing job:`, error.message);
    // Do NOT delete → SQS will handle DLQ routing after 3rd attempt
  }
}

// Polling loop
async function pollNotification() {
  while (true) {
    try {
      const data = await receiveMessages(NOTIFICATION_QUEUE_URL);

      if (data.Messages) {
        await Promise.all(data.Messages.map(processMessage));
      }
    } catch (err) {
      console.error("Error receiving messages:", err);
    }
  }
}

export { pollNotification };
