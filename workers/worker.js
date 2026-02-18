import { receiveMessages, deleteMessage } from "./services/sqs.js";
import { QUEUE_URL } from "./config/sqs.js";

// Worker function
async function processMessage(message) {
  let receiveCount = 0;

  try {
    const snsMessage = JSON.parse(message.Body);
    const messageBody = JSON.parse(snsMessage.Message);

    console.log("[Worker] Received message:", messageBody);
    receiveCount = Number(message.Attributes?.ApproximateReceiveCount || 1);

    // while (messageBody.payload.iterations > 0) {
    //   Math.sqrt(Math.random());
    //   messageBody.payload.iterations--;
    // }
    await new Promise((resolve) => setTimeout(resolve, messageBody.duration));
    console.log("CPU-bound task completed");

    console.log(
      `[Worker] Processing job ${messageBody.type}, attempt #${receiveCount}`
    );

    // if (Math.random() < 0.8) throw new Error("Simulated failure");

    console.log(`[Worker] Job ${messageBody.type} finished successfully.`);


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