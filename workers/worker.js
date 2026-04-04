import { receiveMessages, deleteMessage } from "./services/sqs.js";
import { createTracingSDK } from "./config/otel.js";
const sdk = createTracingSDK("worker-service");
await sdk.start();

import { QUEUE_URL } from "./config/sqs.js";
import "./config/mongo.js";
import Event from "./models/event.js";
import { publisher } from "./config/redis.js";
import logger from "./config/logger.js";
import { context, propagation, trace, SpanStatusCode } from "@opentelemetry/api";

// Worker function
async function processMessage(message) {
  logger.info('Processing message', { messageId: message.MessageId });
  
  // Parse SNS message first
  const snsMessage = JSON.parse(message.Body);
  
  // 1. Extract trace context from SNS message attributes
  const traceparent = snsMessage.MessageAttributes?.traceparent?.Value;
  
  logger.debug('Trace context', { present: !!traceparent });

  const carrier = {
    traceparent,
  };

  const ctx = propagation.extract(context.active(), carrier);

  // 2. Create span INSIDE extracted context
  await context.with(ctx, async () => {
    const tracer = trace.getTracer("worker");

    const span = tracer.startSpan("process-message");
    logger.debug('Started span', { traceId: span.spanContext().traceId });

    try {
      const messageBody = JSON.parse(snsMessage.Message);
      logger.debug('Parsed message body', { type: messageBody.type, hasPayload: !!messageBody.payload });

      span.setAttribute("job.type", messageBody.type);
      span.setAttribute("sqs.message_id", message.MessageId);

      // Simulate work
      logger.debug('Simulating work', { duration: messageBody.duration || 100 });
      await new Promise((resolve) =>
        setTimeout(resolve, messageBody.duration || 100)
      );

      logger.debug('Creating event in database');
      const newEvent = await Event.create({
        type: messageBody.type,
        payload: messageBody.payload,
      });
      logger.info('Event created', { eventId: newEvent._id });

      await publisher.publish(
        "events",
        JSON.stringify({
          ...newEvent,
          traceparent
        })
      );
      logger.debug('Published event to Redis');

      span.setStatus({ code: SpanStatusCode.OK });
      logger.info('Successfully processed message', { messageId: message.MessageId });

      await deleteMessage(QUEUE_URL, message.ReceiptHandle);
    } catch (error) {
      logger.error('Error processing message', { 
        messageId: message.MessageId,
        error: error.message, 
        stack: error.stack,
        name: error.name
      });
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR });
    } finally {
      span.end();
      logger.debug('Span ended', { messageId: message.MessageId });
    }
  });
}

// Polling loop
async function pollQueue() {
  while (true) {
    try {
      logger.debug('Polling queue', { queueUrl: QUEUE_URL });
      const data = await receiveMessages(QUEUE_URL);

      if (data.Messages && data.Messages.length > 0) {
        logger.info('Received messages', { count: data.Messages.length });
        await Promise.all(data.Messages.map(async (message) => {
          try {
            await processMessage(message);
          } catch (error) {
            logger.error('Failed to process message', {
              messageId: message.MessageId,
              error: error.message,
              stack: error.stack,
              name: error.name
            });
            // Continue processing other messages
          }
        }));
      } else {
        logger.debug('No messages available');
      }
    } catch (err) {
      logger.error('Error receiving messages', { error: err.message });
      logger.error('Full error', { error: err });
    }
  }
}

logger.info('Starting worker');
pollQueue();
