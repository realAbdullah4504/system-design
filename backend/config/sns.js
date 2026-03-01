import { SNSClient } from "@aws-sdk/client-sns";
import dotenv from "dotenv";
dotenv.config();

if (!process.env.AWS_REGION || !process.env.TOPIC_ARN) {
    throw new Error("AWS credentials not found");
}
export const snsClient = new SNSClient({
    region: process.env.AWS_REGION,
    // credentials: {
    //     accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    //     secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    // }
});

export const TOPIC_ARN = process.env.TOPIC_ARN;