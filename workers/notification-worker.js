import { receiveMessages, deleteMessage } from "./services/sqs.js";
import { QUEUE_URL } from "./config/notification-sqs.js";
import { publisher } from "./config/redis.js";
import "./config/mongo.js";
import Event from "./models/event.js";

// Worker function
async function processMessage(message) {
  let receiveCount = 0;

  try {
    const snsMessage = JSON.parse(message.Body);
    const messageBody = JSON.parse(snsMessage.Message);

    console.log("[Notification Worker] Received message:", messageBody);
    receiveCount = Number(message.Attributes?.ApproximateReceiveCount || 1);

    // Handle SNS message format
    let jobData;
    if (messageBody.Type === 'Notification') {
      // SNS wraps the original message
      jobData = JSON.parse(messageBody.Message);
      console.log("[Notification Worker] Processing SNS fanout message:", jobData);
    } else {
      // Direct SQS message
      jobData = messageBody;
    }

    console.log(`[Notification Worker] Processing job ${jobData.type}, attempt #${receiveCount}`);
    
    // Store event in database
    await Event.create({
      type: jobData.type || 'notification_processed',
      payload: jobData.payload,
    });
    
    await publisher.publish('event', JSON.stringify(jobData.payload));

    console.log(`[Notification Worker] Job ${jobData.type} finished successfully.`);

    await deleteMessage(QUEUE_URL, message.ReceiptHandle);
  } catch (error) {
    console.error(`[Notification Worker] Error processing job:`, error.message);
    // Do NOT delete → SQS will handle DLQ routing after 3rd attempt
  }
}

// Polling loop
async function pollQueue() {
  while (true) {
    try {
      console.log(`[Notification Worker] Polling queue: ${QUEUE_URL}`);
      const data = await receiveMessages(QUEUE_URL);

      if (data.Messages && data.Messages.length > 0) {
        console.log(`[Notification Worker] Received ${data.Messages.length} messages`);
        await Promise.all(data.Messages.map(processMessage));
      } else {
        console.log(`[Notification Worker] No messages available`);
      }
    } catch (err) {
      console.error("[Notification Worker] Error receiving messages:", err);
    }
  }
}

pollQueue();
