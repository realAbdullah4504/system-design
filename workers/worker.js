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
  const receiveCount = parseInt(message.Attributes?.ApproximateReceiveCount || '1');
  const maxRetries = 3;
  
  logger.info('Processing message', { 
    messageId: message.MessageId,
    attempt: receiveCount,
    maxRetries,
    queueUrl: QUEUE_URL,
    queueArn: process.env.SQS_QUEUE_ARN || 'unknown'
  });
  
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
    // Add retry attributes to span
    span.setAttribute("message.attempt", receiveCount);
    span.setAttribute("message.max_retries", maxRetries);
    span.setAttribute("message.will_retry", receiveCount < maxRetries);
    span.setAttribute("sqs.queue_url", QUEUE_URL);
    span.setAttribute("sqs.queue_arn", process.env.SQS_QUEUE_ARN || 'unknown');
    
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
        name: error.name,
        queueUrl: QUEUE_URL,
        queueArn: process.env.SQS_QUEUE_ARN || 'unknown'
      });
      
      // Enhanced error recording
      span.recordException(error);
      span.setStatus({ 
        code: SpanStatusCode.ERROR,
        message: error.message 
      });
      
      // Add explicit error attributes
      span.setAttribute('error.type', error.name);
      span.setAttribute('error.message', error.message);
      span.setAttribute('error.stack', error.stack);
      span.setAttribute('error.occurred', true);
      span.setAttribute('message.attempt', receiveCount);
      span.setAttribute('sqs.queue_url', QUEUE_URL);
      span.setAttribute('sqs.queue_arn', process.env.SQS_QUEUE_ARN || 'unknown');
      
      // Log retry warning for attempts 1-2, error for attempt 3+
      if (receiveCount < 3) {
        span.setAttribute('message.will_retry', true);
        logger.warn('Message will be retried by SQS', {
          messageId: message.MessageId,
          attempt: receiveCount,
          queueUrl: QUEUE_URL,
          queueArn: process.env.SQS_QUEUE_ARN || 'unknown'
        });
      } else {
        span.setAttribute('message.final_failure', true);
        logger.error('Message moving to DLQ after max retries', {
          messageId: message.MessageId,
          attempt: receiveCount,
          queueUrl: QUEUE_URL,
          queueArn: process.env.SQS_QUEUE_ARN || 'unknown'
        });
      }
      
      // Don't delete message - SQS handles retries and DLQ automatically
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
