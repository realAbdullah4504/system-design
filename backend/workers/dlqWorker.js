import { receiveMessages, deleteMessage } from "../services/sqsService.js";
import { updateJobStatus } from "../services/jobService.js";
import { DLQ_URL } from "../config/sqs.js";

// Polling loop for DLQ monitoring
async function pollDLQ() {
  while (true) {
    try {
      const data = await receiveMessages(DLQ_URL, 10);

      if (data.Messages) {
        console.log(`[DLQ Monitor] Found ${data.Messages.length} failed messages`);
        
        for (const message of data.Messages) {
          const snsNotification = JSON.parse(message.Body);
          const job = JSON.parse(snsNotification.Message);
          console.log(`[DLQ Monitor] Failed job: ${job.jobId}, receive count: ${message.Attributes?.ApproximateReceiveCount}`);
          
          // Update job status to FAILED in database
          await updateJobStatus(job.jobId, { 
            status: "FAILED",
            error: "Job exceeded maximum retry attempts",
            finishedAt: new Date()
          });
          
          console.log(`[DLQ Monitor] Updated job ${job.jobId} status to FAILED`);
          
          // Delete from DLQ after processing/monitoring
          await deleteMessage(DLQ_URL, message.ReceiptHandle);
        }
      }
    } catch (err) {
      console.error("[DLQ Monitor] Error polling DLQ:", err);
    }
  }
}

export { pollDLQ };
