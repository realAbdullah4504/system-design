import { receiveMessages, deleteMessage } from "../services/sqsService.js";
import {
  updateJobDelivery,
  findJobDeliveryByJobIdAndChannel,
} from "../services/jobDeliveryService.js";
import { NOTIFICATION_DLQ_URL } from "../config/sqs.js";
import { aggregateJobStatus } from "../services/jobService.js";

// Polling loop for DLQ monitoring
async function pollDLQNotification() {
  while (true) {
    try {
      const data = await receiveMessages(NOTIFICATION_DLQ_URL, 10);

      if (data.Messages) {
        console.log(
          `[DLQ Monitor] Found ${data.Messages.length} failed messages`
        );
        for (const message of data.Messages) {
          const snsNotification = JSON.parse(message.Body);
          const job = JSON.parse(snsNotification.Message);
          job.channel = "notification";
          const existingJobDelivery = await findJobDeliveryByJobIdAndChannel(
            job.jobId,
            job.channel
          );
          console.log(
            `[DLQ Monitor] Failed job: ${job.jobId}, receive count: ${message.Attributes?.ApproximateReceiveCount}`
          );

          // Update job status to FAILED in database
          await updateJobDelivery(existingJobDelivery._id, {
            status: "FAILED",
            error: "Job exceeded maximum retry attempts",
            finishedAt: new Date(),
          });
          await aggregateJobStatus(job.jobId);
          console.log(
            `[DLQ Monitor] Updated job ${job.jobId} status to FAILED`
          );

          // Delete from DLQ after processing/monitoring
          await deleteMessage(NOTIFICATION_DLQ_URL, message.ReceiptHandle);
        }
      }
    } catch (err) {
      console.error("[DLQ Monitor] Error polling DLQ:", err);
    }
  }
}

export { pollDLQNotification };
