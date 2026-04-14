import { receiveMessages, deleteMessage } from "./services/sqs.js";
import "./config/mongo.js";
import Event from "./models/event.js";
import logger from "./config/logger.js";
import RetryService from "./services/retry-service.js";

// DLQ Queue URL
const DLQ_QUEUE_URL = "https://sqs.us-east-1.amazonaws.com/976589843272/dlq-dev";

// Retry service for SQS operations
const sqsRetryService = new RetryService({
  maxRetries: 3,
  baseDelay: 500,
  maxDelay: 5000,
  retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ServiceUnavailable', 'RequestTimeout']
});

// DLQ Message processor
async function processDLQMessage(message) {
  const receiveCount = Number.parseInt(message.Attributes?.ApproximateReceiveCount || '1');
  
  logger.info('Processing DLQ message', { 
    messageId: message.MessageId,
    attempt: receiveCount,
    queueUrl: DLQ_QUEUE_URL
  });
  
  // Parse SNS message
  const snsMessage = JSON.parse(message.Body);
  const messageBody = JSON.parse(snsMessage.Message);
  
  const startTime = Date.now();

  try {
    logger.info('DLQ processing started', { 
      messageId: message.MessageId,
      jobType: messageBody.type
    });

    // Try to reprocess the message
    try {
      logger.info('Attempting to reprocess DLQ message', { messageId: message.MessageId });
      
      // Re-execute the original logic
      await Event.create({
        type: messageBody.type,
        payload: messageBody.payload,
      });
      
      const processingTime = Date.now() - startTime;
      logger.info('DLQ message reprocessed successfully', {
        messageId: message.MessageId,
        processingTime
      });
      
    } catch (reprocessError) {
      const processingTime = Date.now() - startTime;
      logger.error('DLQ message failed to reprocess', {
        messageId: message.MessageId,
        error: reprocessError.message,
        processingTime
      });
    }
    
    // Delete message from DLQ regardless of outcome
    await sqsRetryService.execute(() => deleteMessage(DLQ_QUEUE_URL, message.ReceiptHandle), {
      operationName: 'delete-dlq-message',
      maxRetries: 2
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    logger.error('DLQ processing failed', {
      messageId: message.MessageId,
      jobType: messageBody.type,
      processingTime,
      error: error.message,
      stack: error.stack
    });
    
    // Don't delete - let SQS handle retries for DLQ processing
  }
}

// DLQ Polling loop
async function pollDLQQueue() {
  while (true) {
    try {
      logger.debug('Polling DLQ queue', { queueUrl: DLQ_QUEUE_URL });
      const data = await sqsRetryService.execute(() => receiveMessages(DLQ_QUEUE_URL), {
        operationName: 'receive-dlq-messages'
      });

      if (data.Messages && data.Messages.length > 0) {
        logger.info('Received DLQ messages', { count: data.Messages.length });
        await Promise.all(data.Messages.map(async (message) => {
          try {
            await processDLQMessage(message);
          } catch (error) {
            logger.error('Failed to process DLQ message', {
              messageId: message.MessageId,
              error: error.message,
              stack: error.stack
            });
          }
        }));
      } else {
        logger.debug('No DLQ messages available');
      }
    } catch (err) {
      logger.error('Error receiving DLQ messages', { error: err.message });
    }
  }
}

logger.info('Starting DLQ worker');
pollDLQQueue();
