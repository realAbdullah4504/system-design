import { receiveMessages, deleteMessage } from "../services/sqsService.js";
import { updateJobStatus, findJobByMessageId } from "../services/jobService.js";
import { sleep } from "../utils/sleep.js";
import { NOTIFICATION_QUEUE_URL } from "../config/sqs.js";

// Worker function
async function processMessage(message) {
    let job = null;
    let receiveCount = 0;

    try {
        job = JSON.parse(message.Body);
        receiveCount = Number(message.Attributes?.ApproximateReceiveCount || 1);

        // Idempotent processing - check if already processed
        const existingJob = await findJobByMessageId(message.MessageId);
        if (existingJob && existingJob.status === "FINISHED") {
            console.log(`[Worker] Job ${job.jobId} already processed, skipping`);
            await deleteMessage(NOTIFICATION_QUEUE_URL, message.ReceiptHandle);
            return;
        }

        console.log(`[Worker] Processing job ${job.jobId}, attempt #${receiveCount}`);

        // Update status to RUNNING
        await updateJobStatus(job.jobId, {
            status: "RUNNING",
            startedAt: new Date(),
            messageId: message.MessageId
        });

        await sleep(2000);

        if (Math.random() < 0.8) throw new Error("Simulated failure");

        console.log(`[Worker] Job ${job.jobId} finished successfully.`);

        await updateJobStatus(job.jobId, {
            status: "FINISHED",
            finishedAt: new Date()
        });

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
