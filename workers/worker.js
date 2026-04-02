import { receiveMessages, deleteMessage } from "./services/sqs.js";
import { createTracingSDK } from "./config/otel.js";
const sdk = createTracingSDK("worker-service");
await sdk.start();

import { QUEUE_URL } from "./config/sqs.js";
import "./config/mongo.js";
import Event from "./models/event.js";
import { publisher } from "./config/redis.js";
import { context, propagation, trace, SpanStatusCode } from "@opentelemetry/api";

// Worker function
async function processMessage(message) {
  console.log(`[WORKER] Processing message ${message.MessageId}`);
  
  // Parse SNS message first
  const snsMessage = JSON.parse(message.Body);
  
  // 1. Extract trace context from SNS message attributes
  const traceparent = snsMessage.MessageAttributes?.traceparent?.Value;
  
  console.log(`[WORKER] Trace context: ${traceparent ? 'present' : 'missing'}`);

  const carrier = {
    traceparent,
  };

  const ctx = propagation.extract(context.active(), carrier);

  // 2. Create span INSIDE extracted context
  await context.with(ctx, async () => {
    const tracer = trace.getTracer("worker");

    const span = tracer.startSpan("process-message");
    console.log(`[WORKER] Started span with trace ID: ${span.spanContext().traceId}`);

    try {
      const messageBody = JSON.parse(snsMessage.Message);
      console.log(`[WORKER] Parsed message body:`, { type: messageBody.type, hasPayload: !!messageBody.payload });

      span.setAttribute("job.type", messageBody.type);
      span.setAttribute("sqs.message_id", message.MessageId);

      // Simulate work
      console.log(`[WORKER] Simulating work for ${messageBody.duration || 100}ms`);
      await new Promise((resolve) =>
        setTimeout(resolve, messageBody.duration || 100)
      );

      console.log(`[WORKER] Creating event in database`);
      const newEvent = await Event.create({
        type: messageBody.type,
        payload: messageBody.payload,
      });
      console.log(`[WORKER] Event created with ID: ${newEvent._id}`);

      await publisher.publish(
        "events",
        JSON.stringify(newEvent)
      );
      console.log(`[WORKER] Published event to Redis`);

      span.setStatus({ code: SpanStatusCode.OK });
      console.log(`[WORKER] Successfully processed message ${message.MessageId}`);

      await deleteMessage(QUEUE_URL, message.ReceiptHandle);
    } catch (error) {
      console.error(`[WORKER] Error processing message ${message.MessageId}:`, {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR });
    } finally {
      span.end();
      console.log(`[WORKER] Span ended for message ${message.MessageId}`);
    }
  });
}

// Polling loop
async function pollQueue() {
  while (true) {
    try {
      console.log(`[WORKER] Polling queue: ${QUEUE_URL}`);
      const data = await receiveMessages(QUEUE_URL);

      if (data.Messages && data.Messages.length > 0) {
        console.log(`[WORKER] Received ${data.Messages.length} messages`);
        await Promise.all(data.Messages.map(async (message) => {
          try {
            await processMessage(message);
          } catch (error) {
            console.error(`[WORKER] Failed to process message ${message.MessageId}:`, {
              message: error.message,
              stack: error.stack,
              name: error.name
            });
            // Continue processing other messages
          }
        }));
      } else {
        console.log(`[WORKER] No messages available`);
      }
    } catch (err) {
      console.error("[WORKER] Error receiving messages:", err.message);
      console.error("[WORKER] Full error:", err);
    }
  }
}

console.log("[WORKER] Starting worker...");
pollQueue();
