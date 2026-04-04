import { receiveMessages, deleteMessage } from "./services/sqs.js";
import { createTracingSDK } from "./config/otel.js";

const sdk = createTracingSDK("notification-worker-service");
await sdk.start();
logger.info("OpenTelemetry started for notification worker");

import { QUEUE_URL } from "./config/notification-sqs.js";
import { publisher } from "./config/redis.js";
import "./config/mongo.js";
import Event from "./models/event.js";
import logger from "./config/notification-logger.js";
import { context, propagation, trace, SpanStatusCode } from "@opentelemetry/api";

// Worker function
async function processMessage(message) {
  logger.info('Processing message', { messageId: message.MessageId });
  
  let receiveCount = 0;

  try {
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
      const tracer = trace.getTracer("notification-worker");
      const span = tracer.startSpan("process-notification-message");
      logger.debug('Started span', { traceId: span.spanContext().traceId });

      try {
        const messageBody = JSON.parse(snsMessage.Message);
        logger.debug('Parsed message body', { type: messageBody.type, hasPayload: !!messageBody.payload });

        receiveCount = Number(message.Attributes?.ApproximateReceiveCount || 1);
        logger.debug('Receive count', { receiveCount });

        span.setAttribute("job.type", messageBody.type);
        span.setAttribute("notification.receive_count", receiveCount);
        span.setAttribute("sqs.message_id", message.MessageId);

        // Handle SNS message format
        let jobData;
        if (messageBody.Type === 'Notification') {
          // SNS wraps the original message
          jobData = JSON.parse(messageBody.Message);
          logger.debug('Processing SNS fanout message', { jobData });
        } else {
          // Direct SQS message
          jobData = messageBody;
        }

        logger.info('Processing job', { type: jobData.type, attempt: receiveCount });
        
        // Store event in database
        logger.debug('Creating event in database');
        const newEvent = await Event.create({
          type: jobData.type || 'notification_processed',
          payload: jobData.payload,
        });
        logger.info('Event created', { eventId: newEvent._id });
        
        await publisher.publish(
          "events",
          JSON.stringify(newEvent)
        );
        logger.debug('Published event to Redis');

        span.setStatus({ code: SpanStatusCode.OK });
        logger.info('Job finished successfully', { type: jobData.type });

        await deleteMessage(QUEUE_URL, message.ReceiptHandle);
        logger.info('Successfully processed message', { messageId: message.MessageId });
      } catch (error) {
        logger.error('Error processing message', { messageId: message.MessageId, error });
        span.recordException(error);
        span.setStatus({ code: SpanStatusCode.ERROR });
        // Do NOT delete → SQS will handle DLQ routing after 3rd attempt
      } finally {
        span.end();
        logger.debug('Span ended', { messageId: message.MessageId });
      }
    });
  } catch (error) {
    logger.error('Error processing job', { error: error.message });
    // Do NOT delete → SQS will handle DLQ routing after 3rd attempt
  }
}

// Polling loop
async function pollQueue() {
  while (true) {
    try {
      logger.debug('Polling queue', { queueUrl: QUEUE_URL });
      const data = await receiveMessages(QUEUE_URL);

      if (data.Messages && data.Messages.length > 0) {
        logger.info('Received messages', { count: data.Messages.length });
        await Promise.all(data.Messages.map(processMessage));
      } else {
        logger.debug('No messages available');
      }
    } catch (err) {
      logger.error('Error receiving messages', { error: err.message });
      logger.error('Full error', { error: err });
    }
  }
}

logger.info('Starting notification worker');
pollQueue();
