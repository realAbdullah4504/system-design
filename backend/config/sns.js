import { SNSClient } from "@aws-sdk/client-sns";
import dotenv from "dotenv";
dotenv.config();
console.log(process.env.AWS_ACCESS_KEY_ID)
console.log(process.env.AWS_SECRET_ACCESS_KEY)
console.log(process.env.AWS_REGION)
console.log(process.env.TOPIC_ARN)
if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !process.env.AWS_REGION || !process.env.TOPIC_ARN) {
    throw new Error("AWS credentials not found");
}
export const snsClient = new SNSClient({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    }
});

export const TOPIC_ARN = process.env.TOPIC_ARN;
