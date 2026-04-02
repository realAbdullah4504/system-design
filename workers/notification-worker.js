import { receiveMessages, deleteMessage } from "./services/sqs.js";
import { createTracingSDK } from "./config/otel.js";

const sdk = createTracingSDK("notification-worker-service");
await sdk.start();
console.log("OpenTelemetry started for notification worker");

import { QUEUE_URL } from "./config/notification-sqs.js";
import { publisher } from "./config/redis.js";
import "./config/mongo.js";
import Event from "./models/event.js";
import { context, propagation, trace, SpanStatusCode } from "@opentelemetry/api";

// Worker function
async function processMessage(message) {
  console.log(`[NOTIFICATION-WORKER] Processing message ${message.MessageId}`);
  
  let receiveCount = 0;

  try {
    const snsMessage = JSON.parse(message.Body);
    
    // 1. Extract trace context from SNS message attributes
    const traceparent = snsMessage.MessageAttributes?.traceparent?.Value;
    console.log(`[NOTIFICATION-WORKER] Trace context: ${traceparent ? 'present' : 'missing'}`);

    const carrier = {
      traceparent,
    };

    const ctx = propagation.extract(context.active(), carrier);

    // 2. Create span INSIDE extracted context
    await context.with(ctx, async () => {
      const tracer = trace.getTracer("notification-worker");
      const span = tracer.startSpan("process-notification-message");
      console.log(`[NOTIFICATION-WORKER] Started span with trace ID: ${span.spanContext().traceId}`);

      try {
        const messageBody = JSON.parse(snsMessage.Message);
        console.log(`[NOTIFICATION-WORKER] Parsed message body:`, { type: messageBody.type, hasPayload: !!messageBody.payload });

        receiveCount = Number(message.Attributes?.ApproximateReceiveCount || 1);
        console.log(`[NOTIFICATION-WORKER] Receive count: ${receiveCount}`);

        span.setAttribute("job.type", messageBody.type);
        span.setAttribute("notification.receive_count", receiveCount);
        span.setAttribute("sqs.message_id", message.MessageId);

        // Handle SNS message format
        let jobData;
        if (messageBody.Type === 'Notification') {
          // SNS wraps the original message
          jobData = JSON.parse(messageBody.Message);
          console.log(`[NOTIFICATION-WORKER] Processing SNS fanout message:`, jobData);
        } else {
          // Direct SQS message
          jobData = messageBody;
        }

        console.log(`[NOTIFICATION-WORKER] Processing job ${jobData.type}, attempt #${receiveCount}`);
        
        // Store event in database
        console.log(`[NOTIFICATION-WORKER] Creating event in database`);
        const newEvent = await Event.create({
          type: jobData.type || 'notification_processed',
          payload: jobData.payload,
        });
        console.log(`[NOTIFICATION-WORKER] Event created with ID: ${newEvent._id}`);
        
        await publisher.publish(
          "events",
          JSON.stringify(newEvent)
        );
        console.log(`[NOTIFICATION-WORKER] Published event to Redis`);

        span.setStatus({ code: SpanStatusCode.OK });
        console.log(`[NOTIFICATION-WORKER] Job ${jobData.type} finished successfully.`);

        await deleteMessage(QUEUE_URL, message.ReceiptHandle);
        console.log(`[NOTIFICATION-WORKER] Successfully processed message ${message.MessageId}`);
      } catch (error) {
        console.error(`[NOTIFICATION-WORKER] Error processing message ${message.MessageId}:`, error);
        span.recordException(error);
        span.setStatus({ code: SpanStatusCode.ERROR });
        // Do NOT delete → SQS will handle DLQ routing after 3rd attempt
      } finally {
        span.end();
        console.log(`[NOTIFICATION-WORKER] Span ended for message ${message.MessageId}`);
      }
    });
  } catch (error) {
    console.error(`[NOTIFICATION-WORKER] Error processing job:`, error.message);
    // Do NOT delete → SQS will handle DLQ routing after 3rd attempt
  }
}

// Polling loop
async function pollQueue() {
  while (true) {
    try {
      console.log(`[NOTIFICATION-WORKER] Polling queue: ${QUEUE_URL}`);
      const data = await receiveMessages(QUEUE_URL);

      if (data.Messages && data.Messages.length > 0) {
        console.log(`[NOTIFICATION-WORKER] Received ${data.Messages.length} messages`);
        await Promise.all(data.Messages.map(processMessage));
      } else {
        console.log(`[NOTIFICATION-WORKER] No messages available`);
      }
    } catch (err) {
      console.error("[NOTIFICATION-WORKER] Error receiving messages:", err.message);
      console.error("[NOTIFICATION-WORKER] Full error:", err);
    }
  }
}

console.log("[NOTIFICATION-WORKER] Starting notification worker...");
pollQueue();
