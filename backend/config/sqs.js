import { SQSClient } from "@aws-sdk/client-sqs";
import dotenv from "dotenv";

dotenv.config();

export const REGION = process.env.AWS_REGION || "us-east-1";
export const QUEUE_URL = process.env.SQS_QUEUE_URL;
export const DLQ_URL = process.env.SQS_DLQ_URL;

export const sqsClient = new SQSClient({ 
  region: REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});
