import { receiveMessages, deleteMessage } from "./services/sqs.js";
import { QUEUE_URL } from "./config/sqs.js";

// Worker function
async function processMessage(message) {
  let receiveCount = 0;

  try {
    const snsNotification = JSON.parse(message.Body);
    const messageBody = JSON.parse(snsNotification.Message);
    receiveCount = Number(message.Attributes?.ApproximateReceiveCount || 1);

    if (messageBody.status === "FINISHED") {
      console.log(`[Worker] Job ${messageBody.jobId} already processed, skipping`);
      await deleteMessage(QUEUE_URL, message.ReceiptHandle);
      return;
    }

    console.log(
      `[Worker] Processing job ${messageBody.jobId}, attempt #${receiveCount}`
    );

    if (Math.random() < 0.8) throw new Error("Simulated failure");

    console.log(`[Worker] Job ${messageBody.jobId} finished successfully.`);


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
pollQueue();