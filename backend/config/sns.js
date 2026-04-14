import { SNSClient } from "@aws-sdk/client-sns";
import { config } from "./env.js";

if (!config.aws.region || !config.aws.sns.topicArn) {
    throw new Error("AWS credentials not found");
}
export const snsClient = new SNSClient({
    region: config.aws.region,
    // credentials: {
    //     accessKeyId: config.aws.accessKeyId,
    //     secretAccessKey: config.aws.secretAccessKey,
    // }
});

export const TOPIC_ARN = config.aws.sns.topicArn;