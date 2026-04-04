import { SendMessageCommand, ReceiveMessageCommand, DeleteMessageCommand } from "@aws-sdk/client-sqs";
import { sqsClient, QUEUE_URL} from "../config/sqs.js";

export const sendMessage = async (messageBody) => {
  const command = new SendMessageCommand({
    QueueUrl: QUEUE_URL,
    MessageBody: JSON.stringify(messageBody),
  });

  return await sqsClient.send(command);
};


export const receiveMessages = async (queueUrl, maxMessages = 5) => {
  const command = new ReceiveMessageCommand({
    QueueUrl: queueUrl,
    MaxNumberOfMessages: maxMessages,
    WaitTimeSeconds: 10,
    VisibilityTimeout: 20,
    AttributeNames: ["ApproximateReceiveCount", "MessageId"],
    MessageAttributeNames: ["All"],
  });

  return await sqsClient.send(command);
};

export const deleteMessage = async (queueUrl, receiptHandle) => {
  const command = new DeleteMessageCommand({
    QueueUrl: queueUrl,
    ReceiptHandle: receiptHandle,
  });

  return await sqsClient.send(command);
};

export const sendToDLQ = async (message, error) => {
  // Minimal implementation - just log, don't actually send
  console.log(`[DLQ] Would send message ${message.MessageId} to DLQ: ${error.message}`);
  console.log(`[DLQ] Receive count: ${message.Attributes?.ApproximateReceiveCount || '1'}`);
  return { messageId: message.MessageId, action: 'logged-only' };
};