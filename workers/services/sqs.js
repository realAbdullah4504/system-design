import { SendMessageCommand, ReceiveMessageCommand, DeleteMessageCommand, GetQueueAttributesCommand } from "@aws-sdk/client-sqs";
import { sqsClient, QUEUE_URL} from "../config/sqs.js";

// Test SQS connection
export const testSQSConnection = async () => {
  try {
    const command = new GetQueueAttributesCommand({
      QueueUrl: QUEUE_URL,
      AttributeNames: ["QueueArn"]
    });
    
    const response = await sqsClient.send(command);
    console.log("SQS connection successful:", response.Attributes?.QueueArn);
    return true;
  } catch (error) {
    console.error("SQS connection failed:", error.message);
    throw new Error(`SQS connection failed: ${error.message}`);
  }
};

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