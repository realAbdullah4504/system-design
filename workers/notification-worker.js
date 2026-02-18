import { receiveMessages, deleteMessage } from "./services/sqs.js";
import { QUEUE_URL } from "./config/notification-sqs.js";

// Notification Worker function
async function processMessage(message) {
  let receiveCount = 0;

  try {
    const messageBody = JSON.parse(message.Body);
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

    console.log(`[Notification Worker] Processing job ${jobData.jobId}, attempt #${receiveCount}`);
    
    // Process different channels
    if (jobData.channels && jobData.channels.length > 0) {
      for (const channel of jobData.channels) {
        await processNotificationChannel(channel, jobData);
      }
    } else {
      console.log("[Notification Worker] No channels specified, skipping notification");
    }

    console.log(`[Notification Worker] Job ${jobData.jobId} finished successfully.`);

    await deleteMessage(QUEUE_URL, message.ReceiptHandle);
  } catch (error) {
    console.error(`[Notification Worker] Error processing job:`, error.message);
    // Do NOT delete → SQS will handle DLQ routing after 3rd attempt
  }
}

// Process individual notification channels
async function processNotificationChannel(channel, jobData) {
  console.log(`[Notification Worker] Processing ${channel} notification for job ${jobData.jobId}`);
  
  switch (channel) {
    case 'notification':
      await sendPushNotification(jobData);
      break;
    case 'email':
      await sendEmailNotification(jobData);
      break;
    case 'sms':
      await sendSMSNotification(jobData);
      break;
    default:
      console.log(`[Notification Worker] Unknown channel: ${channel}`);
  }
}

// Simulate push notification
async function sendPushNotification(jobData) {
  console.log(`[Notification Worker] Sending push notification for job ${jobData.jobId}`);
  // Simulate API call delay
  await new Promise((resolve) => setTimeout(resolve, 100));
  console.log(`[Notification Worker] Push notification sent for job ${jobData.jobId}`);
}

// Simulate email notification
async function sendEmailNotification(jobData) {
  console.log(`[Notification Worker] Sending email notification for job ${jobData.jobId}`);
  // Simulate email service delay
  await new Promise((resolve) => setTimeout(resolve, 200));
  console.log(`[Notification Worker] Email notification sent for job ${jobData.jobId}`);
}

// Simulate SMS notification
async function sendSMSNotification(jobData) {
  console.log(`[Notification Worker] Sending SMS notification for job ${jobData.jobId}`);
  // Simulate SMS service delay
  await new Promise((resolve) => setTimeout(resolve, 150));
  console.log(`[Notification Worker] SMS notification sent for job ${jobData.jobId}`);
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
