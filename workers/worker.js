import { receiveMessages, deleteMessage } from "./services/sqs.js";
import { startTracing } from "./config/otel.js";
await startTracing();

import { QUEUE_URL } from "./config/sqs.js";
import "./config/mongo.js";
import Event from "./models/event.js";
import { publisher } from "./config/redis.js";
import { context, propagation, trace, SpanStatusCode } from "@opentelemetry/api";

// Worker function
async function processMessage(message) {
  // Parse SNS message first
  const snsMessage = JSON.parse(message.Body);
  
  // 1. Extract trace context from SNS message attributes
  const traceparent = snsMessage.MessageAttributes?.traceparent?.Value;
  
  console.log(traceparent,"traceparent=================>");

  const carrier = {
    traceparent,
  };

  const ctx = propagation.extract(context.active(), carrier);

  // 2. Create span INSIDE extracted context
  await context.with(ctx, async () => {
    const tracer = trace.getTracer("worker");

    const span = tracer.startSpan("process-message");
    console.log(span.spanContext().traceId,"span=================>");

    try {
      const messageBody = JSON.parse(snsMessage.Message);

      span.setAttribute("job.type", messageBody.type);
      span.setAttribute("sqs.message_id", message.MessageId);

      // Simulate work
      await new Promise((resolve) =>
        setTimeout(resolve, messageBody.duration || 100)
      );

      const newEvent = await Event.create({
        type: messageBody.type,
        payload: messageBody.payload,
      });

      await publisher.publish(
        "events",
        JSON.stringify(newEvent)
      );

      span.setStatus({ code: SpanStatusCode.OK });

      await deleteMessage(QUEUE_URL, message.ReceiptHandle);
    } catch (error) {
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
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
