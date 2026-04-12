import { receiveMessages, deleteMessage, testSQSConnection } from "./services/sqs.js";
import { createTracingSDK } from "./config/otel.js";
const sdk = createTracingSDK("worker-service");
await sdk.start();

import { QUEUE_URL } from "./config/sqs.js";
import "./config/mongo.js";
import Event from "./models/event.js";
import { publisher } from "./config/redis.js";
import logger from "./config/logger.js";
import CircuitBreaker from "./services/circuit-breaker.js";
import { context, propagation, trace, SpanStatusCode } from "@opentelemetry/api";
import {
  recordJobStart,
  recordJobSuccess,
  recordJobFailure,
  updateMemoryUsage,
  setWorkerHealth,
  recordException,
  recordDatabaseError,
  recordDatabaseOperationStart,
  recordDatabaseOperationSuccess,
  recordDatabaseOperationFailure,
  recordRedisError,
  recordSQSError,
  setCircuitBreakerState,
  recordCircuitBreakerFailure,
  recordCircuitBreakerOperation,
  workerUptime,
  queueDepth
} from "./services/prom.js";
import "./metrics-server.js";

// Test SQS connection on startup
try {
  await testSQSConnection();
  logger.info('SQS connection test passed');
} catch (error) {
  logger.error('SQS connection test failed', { error: error.message });
  process.exit(1);
}

// Worker type identifier
const WORKER_TYPE = "main-worker";

// Circuit breaker instances
const dbCircuitBreaker = new CircuitBreaker({
  name: 'database',
  failureThreshold: 1,
  resetTimeout: 30000, // 30 seconds
  monitoringPeriod: 5000 // 5 seconds
});

const redisCircuitBreaker = new CircuitBreaker({
  name: 'redis',
  failureThreshold: 3,
  resetTimeout: 30000, // 30 seconds
  monitoringPeriod: 5000 // 5 seconds
});

// Initialize circuit breaker monitoring
setCircuitBreakerState(WORKER_TYPE, 'database', dbCircuitBreaker.getState().state);
setCircuitBreakerState(WORKER_TYPE, 'redis', redisCircuitBreaker.getState().state);

// Track worker start time
const workerStartTime = Date.now();

// Set initial worker health
setWorkerHealth(WORKER_TYPE, true);

// Update uptime metric
workerUptime.labels(WORKER_TYPE).set(0);

// Periodically update metrics
setInterval(() => {
  const uptime = (Date.now() - workerStartTime) / 1000;
  workerUptime.labels(WORKER_TYPE).set(uptime);
  updateMemoryUsage(WORKER_TYPE);
}, 10000); // Update every 10 seconds

// Worker function
async function processMessage(message) {
  const receiveCount = Number.parseInt(message.Attributes?.ApproximateReceiveCount || '1');
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
    let jobStartTime;
    const messageBody = JSON.parse(snsMessage.Message);
    const jobTimer = recordJobStart(WORKER_TYPE, messageBody.type);
    jobStartTime = Date.now();

    try {
      logger.debug('Parsed message body', { type: messageBody.type, hasPayload: !!messageBody.payload });

      logger.info('Job processing started', { 
        messageId: message.MessageId, 
        jobType: messageBody.type,
        startTime: jobStartTime
      });
      
      span.setAttribute("job.type", messageBody.type);
      span.setAttribute("sqs.message_id", message.MessageId);

      // Simulate work
      logger.debug('Simulating work', { duration: messageBody.duration || 100 });
      await new Promise((resolve) =>
        setTimeout(resolve, messageBody.duration || 100)
      );

      logger.debug('Creating event in database');
      const dbOp = 'event_create';
      const dbTimer = recordDatabaseOperationStart(WORKER_TYPE, dbOp);
      let newEvent;
      try {
        newEvent = await dbCircuitBreaker.execute(
          () => Event.create({
            type: messageBody.type,
            payload: messageBody.payload,
          }),
          'database-create'
        );
        recordDatabaseOperationSuccess(dbTimer, WORKER_TYPE, dbOp);
      } catch (dbError) {
        recordDatabaseOperationFailure(dbTimer, WORKER_TYPE, dbOp);
        throw dbError;
      }
      logger.info('Event created', { eventId: newEvent._id });

      await redisCircuitBreaker.execute(
        () => publisher.publish(
          "events",
          JSON.stringify({
            ...newEvent,
            traceparent
          })
        ),
        'redis-publish'
      );
      logger.debug('Published event to Redis');

      span.setStatus({ code: SpanStatusCode.OK });
      
      // Calculate exact processing time
      const processingTimeMs = Date.now() - jobStartTime;
      const processingTimeSec = processingTimeMs / 1000;
      
      logger.info('Job completed successfully', { 
        messageId: message.MessageId,
        jobType: messageBody.type,
        processingTimeMs,
        processingTimeSec: processingTimeSec.toFixed(3)
      });

      // Record job success
      recordJobSuccess(jobTimer, WORKER_TYPE, messageBody.type);

      await deleteMessage(QUEUE_URL, message.ReceiptHandle);
    } catch (error) {
      // Calculate processing time even for failures
      const processingTimeMs = Date.now() - jobStartTime;
      const processingTimeSec = processingTimeMs / 1000;
      
      // Log circuit breaker states if relevant
      const dbState = dbCircuitBreaker.getState();
      const redisState = redisCircuitBreaker.getState();
      
      logger.error('Error processing message', { 
        messageId: message.MessageId,
        jobType: messageBody?.type || 'unknown',
        processingTimeMs,
        processingTimeSec: processingTimeSec.toFixed(3),
        error: error.message, 
        stack: error.stack,
        name: error.name,
        queueUrl: QUEUE_URL,
        queueArn: process.env.SQS_QUEUE_ARN || 'unknown',
        circuitBreakers: {
          database: dbState,
          redis: redisState
        }
      });
      
      // Record circuit breaker specific errors
      if (error.message.includes('Circuit breaker is OPEN')) {
        if (error.message.includes('database-create')) {
          recordDatabaseError(WORKER_TYPE, 'circuit_breaker_open');
        } else if (error.message.includes('redis-publish')) {
          recordRedisError(WORKER_TYPE, 'circuit_breaker_open');
        }
      }
      
      // Record job failure
      recordJobFailure(jobTimer, WORKER_TYPE, messageBody?.type || 'unknown', error.name);
      
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

      // Update queue depth metric
      if (data.Messages) {
        queueDepth.labels(WORKER_TYPE, QUEUE_URL).set(data.Messages.length);
      }

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
            // Record processing exception
            recordException(WORKER_TYPE, 'processing_error');
            // Continue processing other messages
          }
        }));
      } else {
        logger.debug('No messages available');
        queueDepth.labels(WORKER_TYPE, QUEUE_URL).set(0);
      }
    } catch (err) {
      logger.error('Error receiving messages', { error: err.message });
      logger.error('Full error', { error: err });
      // Record SQS error
      recordSQSError(WORKER_TYPE, 'receive_messages', err.name);
    }
  }
}

logger.info('Starting worker');
pollQueue();
