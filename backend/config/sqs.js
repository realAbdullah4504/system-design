import { SQSClient } from "@aws-sdk/client-sqs";
import { config } from "./env.js";

export const REGION = config.aws.region || "us-east-1";
export const QUEUE_URL = config.aws.sqs.queueUrl;

export const sqsClient = new SQSClient({
  region: config.aws.region,
  // credentials: {
  //   accessKeyId: config.aws.accessKeyId,
  //   secretAccessKey: config.aws.secretAccessKey,
  // },
});
