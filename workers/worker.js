import { receiveMessages, deleteMessage } from "./services/sqs.js";
import { QUEUE_URL } from "./config/sqs.js";
import "./config/mongo.js";
import Event from "./models/event.js";
import { publisher } from "./config/redis.js";

// Worker function
async function processMessage(message) {
  let receiveCount = 0;

  try {
    console.log(
      `[WORKER] Raw message received:`,
      JSON.stringify(message, null, 2)
    );

    const snsMessage = JSON.parse(message.Body);
    const messageBody = JSON.parse(snsMessage.Message);

    console.log(`[WORKER] Parsed message:`, messageBody);
    console.log(`[WORKER] Message ID: ${message.MessageId}`);
    console.log(`[WORKER] Receipt Handle : ${message.ReceiptHandle}`);
    receiveCount = Number(message.Attributes?.ApproximateReceiveCount || 1);
    console.log(`[WORKER] Receive count: ${receiveCount}`);

    // while (messageBody.payload.iterations > 0) {
    //   Math.sqrt(Math.random());
    //   messageBody.payload.iterations--;
    // }
    await new Promise((resolve) => setTimeout(resolve, messageBody.duration));
    console.log("CPU-bound task completed");

    console.log(
      `[WORKER] Processing job ${messageBody.type}, attempt #${receiveCount}`
    );

    console.log(`[WORKER] Storing event in database...`);
    const newEvent = await Event.create({
      type: messageBody.type,
      payload: messageBody.payload,
    });
    await publisher.publish(
      "events",
      JSON.stringify(newEvent.toJSON())
    );
    console.log(`[WORKER] Event stored successfully in database`);

    // if (Math.random() < 0.8) throw new Error("Simulated failure");

    console.log(`[WORKER] Job ${messageBody.type} finished successfully.`);

    console.log(`[WORKER] Deleting message from queue...`);
    await deleteMessage(QUEUE_URL, message.ReceiptHandle);
    console.log(`[WORKER] Message deleted successfully`);
  } catch (error) {
    console.error(`[WORKER] ERROR processing job:`, error.message);
    console.error(`[WORKER] Full error:`, error);
    console.log(`[WORKER] Message NOT deleted - will retry via SQS`);
    // Do NOT delete → SQS will handle DLQ routing after 3rd attempt
  }
}

// Polling loop
async function pollQueue() {
  while (true) {
    try {
      console.log(`[WORKER] Polling queue: ${QUEUE_URL}`);
      const data = await receiveMessages(QUEUE_URL);

      if (data.Messages && data.Messages.length > 0) {
        console.log(`[WORKER] Received ${data.Messages.length} messages`);
        await Promise.all(data.Messages.map(processMessage));
      } else {
        console.log(`[WORKER] No messages available`);
      }
    } catch (err) {
      console.error("[WORKER] Error receiving messages:", err);
      console.error("[WORKER] Full error:", err);
    }
  }
}
pollQueue();
